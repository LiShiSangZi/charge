'use strict';

/**
 * Base class for the common service.
 * 
 */
module.exports = (app) => {
  class BaseService extends app.Service {
    constructor(ctx) {
      super(ctx);
    }

    async OPTION(opt) {

    }

    async PATCH(opt) {
      // Did nothing for now.
    }

    /**
     * For update: Close the current order and create a new one.
     * @param {*Options} opt 
     */
    async PUT(opt) {
      if (opt.phase === 'before') {
        const option = await this.getPriceAndAmountOption(opt);
        if (!option) {
          return;
        }
        const project = await this.ctx.model.Project.findProjectWithAccountById(opt.projectId);
        if (!project || !project.account) {
          return;
        }
        const uuid = this.parsePutUUID(opt);
        const order = await this.ctx.model.Order.findOrderByResource(uuid, opt.region);
        let estimatePrice = option.price;
        if (order && order.length > 0) {
          estimatePrice = Math.max(0, option.price - order[0].unit_price);
          if (estimatePrice === 0 && order[0].product_id === option.product.product_id) {
            return;
          }
          // console.log(estimatePrice, order[0].product_id, option.product.product_id);
        }
        await this.freeze(estimatePrice, option.price,
          option.product.product_id, project.account.user_id, opt);

      } else if (opt.phase === 'after') {
        const tempOrder = await this.ctx.model.Frozen.findByRequestId(opt.requestId);

        if (!tempOrder) {
          return;
        }

        if (opt.statusCode >= 400) {
          await tempOrder.destroy();
          return;
        }

        // End the exist order:
        const uuid = this.parsePutUUID(opt);

        await this.closeOrder(uuid, opt.region);

        const body = opt.request;
        const resp = opt.response;
        let attr = this.getResourceAttribute(body, resp, opt.tag);
        if (!attr) {
          attr = await this.getResourceById(uuid, opt);
        }
        attr.unit_price = tempOrder.unit_price;
        attr.region = tempOrder.region;
        attr.project_id = tempOrder.project_id;
        attr.domain_id = tempOrder.domain_id;
        attr.type = tempOrder.type
        attr.product_id = tempOrder.product_id;
        attr.user_id = tempOrder.user_id;

        // 解冻费用。生成order。
        await tempOrder.destroy();

        await this.ctx.model.Order.createOrder(attr);
      }
    }

    /**
     * Handle POST logic. Most POST handles the create logic. So will create an order.
     * @param {*Options} opt 
     */
    async POST(opt) {
      if (!opt.tag || opt.tag.length < 1) {
        return;
      }
      if (opt.phase === 'before') {
        const option = await this.getPriceAndAmountOption(opt);
        if (!option) {
          // There are no releated product for this resource.
          return;
        }
        const project = await this.ctx.model.Project.findProjectWithAccountById(opt.projectId);
        if (!project || !project.account) {
          // The project does not exist or the project does not have billing owner.
          // FIXME: Throw an error for this.
          return;
        }
        await this.freeze(option.price, option.price,
          option.product.product_id, project.account.user_id, opt);

      } else if (opt.phase === 'after') {
        const tempOrder = await this.ctx.model.Frozen.findByRequestId(opt.requestId);
        if (!tempOrder) {
          // No frozen data found. Because the resource does not require charge.
          return;
        }

        if (opt.statusCode >= 400) {
          await tempOrder.destroy();
          return;
        }

        const body = opt.request;
        const resp = opt.response;
        let attr = this.getResourceAttribute(body, resp, opt.tag);
        attr.unit_price = tempOrder.unit_price;
        attr.region = tempOrder.region;
        attr.project_id = tempOrder.project_id;
        attr.domain_id = tempOrder.domain_id;
        attr.type = tempOrder.type;
        attr.user_id = tempOrder.user_id;
        attr.product_id = tempOrder.product_id;

        // 解冻费用。生成order。
        await tempOrder.destroy();

        await this.ctx.model.Order.createOrder(attr);
      }
    }

    async DELETE(opt) {
      const region = opt.region;
      const uuid = this.parseDeleteUUID(opt.requestUrl);
      await this.closeOrder(uuid, region);
    }

    /**
     * Handle the GET logic. Most get is for query purpose. So do nothing for now.
     * 
     * @param {*Options} opt 
     */
    async GET(opt) {
      // await this.getProduct(region, body, catalogs);
    }

    /**
     * Frozen the money before forwarding the request to backend.
     */
    async freeze(total, unitPrice, productId, userId, opt) {
      // 冻结用户一个小时的费用。
      const attr = {
        unit: 'hour',
        unit_price: unitPrice,
        total_price: total,
        region: opt.region,
        project_id: opt.projectId,
        domain_id: opt.domainId,
        type: opt.tag,
        product_id: productId,
        request_id: opt.requestId,
        user_id: userId,
      }
      const tempOrder = await this.ctx.model.Frozen.create(attr);
      if (!tempOrder) {
        throw new Error('Error: the billing system can not save your order!');
      }
    }

    fetchTag(pathArray, request_url) {
      return pathArray[0].replace(/(e*)s$/, '$1');
    }

    /**
     * Get the price and amount information according to the option.
     * @return the object including product_id, price and amount.
     */
    async getPriceAndAmountOption(opt) {
      const region = opt.region;
      const catalogs = opt.catalog;
      const body = opt.request;
      const resp = opt.response;

      const amount = await this.getProductAmount(body, opt);
      const product = await this.getProduct(opt.module, opt.tag, region, body, catalogs);
      if (!product) {
        // The product is not defined. Ignore creating order.
        return;
      }
      const priceObj = JSON.parse(product.unit_price);
      const price = this.ctx.service.price.calculatePrice(priceObj, amount);
      const productId = product.id;
      return {
        amount,
        product,
        price,
      }
    }

    /**
     * Calculate the current order and close it.
     * @param {*String} uuid 
     * @param {*String} region 
     */
    async closeOrder(uuid, region) {
      if (!region) {
        region = 'RegionOne';
      }
      // Check if we have any order for the uuid:
      const orders = await this.ctx.model.Order.findOrderByResource(uuid, region);
      if (!orders || orders.length < 1) {
        return;
      }
      let promises = [];
      let promisesIndex = 0;
      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        if (order.deduct_id) {
          const deduct = await this.ctx.model.Deduct.findOne({
            where: {
              deduct_id: order.deduct_id
            }
          });
          let project = await this.ctx.model.Project.findOne({
            where: {
              project_id: order.project_id,
            }
          });
          let user = null;
          if (project && project.user_id) {
            user = await this.ctx.model.Account.findOne({
              where: {
                user_id: project.user_id,
              }
            });
          }
          // Calculate the order's charge and close it.
          this.ctx.service.utils.order.calOrder(order, deduct, project, user, true);
        }
      }

      await Promise.all(promises);
    }

    async getUnit(body) {
      return 'hour';
    }

    async getProductName(service, tag, body, catalogs, region) {
      return `${service}:${tag}`;
    }

    /**
     * Parse the uuid out from a request url.
     */
    parseDeleteUUID(url) {
      return url.replace(/\/$/, '').replace(/^(.*)\//, '').replace(/\?(.*)$/, '').replace(/\.json$/, '');
    }

    /**
     * Parse the uuid out from an option.
     * @param {*Options} opt 
     */
    parsePutUUID(opt) {
      return opt.requestUrl.replace(/\/$/, '').replace(/^(.*)\//, '').replace(/\?(.*)$/, '').replace(/\.json$/, '');
    }

    /**
     * Get the endpoint's name according by the option.
     * @param {*Option} opt 
     */
    getModuleName(opt) {
      return opt.module;
    }

    getTagName(opt) {
      return opt.tag + 's';
    }

    async getTokenAndEndpoint(opt) {
      const tokenObj = await this.ctx.service.token.getToken();
      const module = this.getModuleName(opt);
      if (!tokenObj.endpoint[module]) {
        throw new Error('The module name is invalid!');
      }
      const endpoint = tokenObj.endpoint[module][opt.region || 'RegionOne'];

      return {
        "token": tokenObj.token,
        "endpoint": endpoint,
      };
    }

    async getSingleResourceById(uuid, opt) {
      const o = await this.getTokenAndEndpoint(opt);
      const res = await this.ctx.curl(`${o.endpoint}/${this.getTagName(opt)}/${uuid}`, {
        method: 'GET',
        dataType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': o.token,
        },
        timeout: 5000,
      });
      const resultObj = res.data[opt.tag];
      return resultObj;
    }

    async getResourceById(uuid, opt) {
      const resultObj = await this.getSingleResourceById(uuid, opt);
      return {
        "resource_id": resultObj.id,
        "resource_name": resultObj.name,
      };
    }

    getResourceAttribute(req, res, tag) {
      if (res) {
        const o = {
          "resource_id": res[this.tag || tag].id,
          "resource_name": res[this.tag || tag].name,
        };
        if (!o.resource_name) {
          o.resource_name = req[this.tag || tag].name;
        }
        return o;
      }
      return null;
    }

    async getProductAmount(body) {
      return 1;
    }

    async getProduct(service, tag, region, body, catalogs) {
      const name = await this.getProductName(service, tag, body, catalogs, region);
      const res = await this.ctx.model.Product.findProduct(region, name);
      if (res) {
        const ob = res.dataValues;
        return ob;
      }
      return null;
    }


    formAPIQueryStr(service, tag, obj, rest) {
      return `${obj.endpoint}/${tag}s?all_tenants=1`;
    }

    /**
     * Generate the mock request for a body.
     */
    async generateReq(resource, module, tag, region) {
      return {};
    }

    /**
     * Generate the response for a body.
     */
    async generateRes(resource, module, tag, region) {
      const o = {};

      o[tag] = resource;
      return o;
    }

    async getProjectId(resource) {
      return resource.projectId || resource.tenant_id || resource.project_id;
    }

    async getUserId(resource) {
      return resource.userId;
    }

    /**
     * Generate the resource option. It is for external user.
     */
    async generateOption(resource, module, tag, region) {
      return {
        "module": module,
        "tag": tag,
        "region": region,
        "catalog": null,
        "request": await this.generateReq(resource, module, tag, region),
        "response": await this.generateRes(resource, module, tag, region),
        "requestUrl": null,
      };
    }

    async filterResult(result, service, tag, obj, rest) {
      return result;
    }

    /**
     * Get the full list of resource according to the parameter.
     */
    async getFullResources(service, tag, region, rest) {
      const o = {
        module: service,
        region: region,
      };

      const obj = await this.getTokenAndEndpoint(o);
      if (!obj || !obj.endpoint) {
        throw new Error('The region is invalid or the module is invalid!');
      }

      const res = await this.ctx.curl(this.formAPIQueryStr(service, tag, obj, rest), {
        method: 'GET',
        dataType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': obj.token,
        },
        timeout: 20000,
      });

      if (res && res.data) {
        return await this.filterResult(res.data, tag, obj, rest);
      }
    }
  }
  return BaseService;
}