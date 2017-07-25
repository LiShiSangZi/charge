'use strict';

const uuidV4 = require('uuid/v4');

/**
 * Close all orders and calulate the balance at once. According to the product id.
 * This is used when a product is updated or deleted.
 *
 * @param {*Context} ctx.product_id The target product id.
 * @param {*Transaction} transaction The transaction instance.
 */
async function closeOrders(ctx, transaction) {
  const params = ctx.params;
  const orders = await ctx.model.Order.findOrderByProductId(params.product_id);

  const addOpt = {};
  if (transaction) {
    addOpt.transaction = transaction;
  }

  ctx.body = {};

  let promises = [];
  let promisesIndex = 0;
  const res = [];
  const projects = {};
  const users = {};
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    if (order.deduct_id) {
      const deduct = await ctx.model.Deduct.findOne({
        where: {
          deduct_id: order.deduct_id
        },
        transaction: transaction,
      });
      let project = await ctx.model.Project.findOne({
        where: {
          project_id: order.project_id,
        },
        transaction: transaction,
      });
      let user = null;
      if (project && project.user_id) {
        user = await ctx.model.Account.findOne({
          where: {
            user_id: project.user_id,
          },
          transaction: transaction,
        });
      }
      projects[project.project_id] = project;
      users[user.user_id] = user;
      // Calculate the order's charge and close it.
      await ctx.service.utils.order.calOrder(order, deduct, project, user, true, false, transaction);
    }

    for (let k in projects) {
      const project = projects[k];
      await project.save(addOpt);
    }

    for (let k in users) {
      const user = users[k];
      await ctx.service.account.setAccount(user, addOpt);
    }

    res[i] = JSON.parse(JSON.stringify(order.toJSON()));
    delete res[i]['created_at'];
    delete res[i]['updated_at'];
  }

  return res;
}

async function buildOrders(ctx, reqBody, module, tag, rest, t) {
  const region = reqBody.region_id || 'RegionOne';
  let service = ctx.service;

  if (service && service[module] && service[module][tag]) {
    service = ctx.service[module][tag];
  } else {
    service = ctx.service.common;
  }

  /**
   * Fetch all the project list so that we can provide the domain_id and project_id for order.
   * We may not be able to provide the user_id as we do not know the user created the resource.
   */
  const query = {
    module: 'keystone',
    region: reqBody.region_id || 'RegionOne',
  };

  // const endpointObj = await service.getTokenAndEndpoint(query);
  const resources = await service.getFullResources(module, tag, region, rest);
  const keyFields = `${tag}s`;


  const priceObj = reqBody.unit_price;

  const cachedProjects = {};
  // For each resource. We need to create a new order for it.
  if (resources[keyFields]) {
    const orders = [];
    const deducts = [];
    const now = Math.round(Date.now() / 1000);
    for (let resource of resources[keyFields]) {
      const opt = await service.generateOption(resource, module, tag, query.region);
      const projectId = await service.getProjectId(resource);
      let projectOpt = cachedProjects[projectId];
      if (!projectOpt) {
        projectOpt = await ctx.model.Project.findProjectWithAccountById(projectId, t);
        cachedProjects[projectId] = projectOpt;
      }

      if (!projectOpt || !projectOpt.user_id) {
        // The project does not have billing owner. Skip this.
        continue;
      }

      const body = opt.request;
      const resp = opt.response;
      const amount = await service.getProductAmount(body, opt);
      const price = ctx.service.price.calculatePrice(priceObj, amount);
      const attr = service.getResourceAttribute(body, resp, opt.tag);
      const deductId = uuidV4();
      const orderId = uuidV4();

      attr.unit_price = price;
      attr.region = region;
      attr.project_id = projectId;
      attr.domain_id = projectOpt.domain_id;
      attr.user_id = projectOpt.user_id;
      attr.type = opt.tag;
      attr.product_id = reqBody.product_id;
      attr.order_id = orderId;
      attr.deduct_id = deductId;
      // await ctx.model.Order.createOrder(attr);
      orders.push(attr);

      deducts.push({
        deduct_id: deductId,
        resource_id: attr.resource_id,
        type: attr.type,
        price: attr.unit_price,
        order_id: orderId,
        updated_at: now * 1000,
        created_at: now * 1000,
      });
    }
    const p1 = ctx.model.Order.bulkCreate(orders, {
      transaction: t,
    });
    const p2 = ctx.model.Deduct.bulkCreate(deducts, {
      transaction: t,
    });

    const result = await Promise.all([p1, p2]);
    resources.orders = result[0];
    // resources.deducts = result[1];
  }
  return resources;
}

module.exports = app => {
  class ProductService extends app.Service {
    constructor(...props) {
      super(...props);
    }
  }
  Object.assign(ProductService.prototype, {
    closeOrders,
    buildOrders,
  });
  return ProductService;
};
