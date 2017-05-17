'use strict';
const uuidV4 = require('uuid/v4');

exports.detail = async(ctx) => {
  const products = await ctx.model.Product.listAll();
  ctx.body = {
    "products": products,
    "total_count": products.length,
  };
}

exports.create = async(ctx) => {
  if (!ctx.isAdmin) {
    ctx.throw(409);
  }
  const body = ctx.request.body;
  const name = body.name;
  const [module, tag, ...rest] = name.split(':');

  if (!module || !tag) {
    ctx.throw(400, 'The product name should look like ${module}:${type}.');
  }
  if (module === 'nova' && tag === 'server' && rest.length < 1) {
    ctx.throw(400, 'You need to speicific flavor for nova server\'s product.');
  } else if (module === 'cinder') {
    if (rest.length < 1) {
      if (tag === 'volume' || tag === 'snapshot') {
        ctx.throw(400, 'You need to speicific the volume type.');
      }
    }
  }
  /**
   * TODO: 扫描所有现有的资源，找到所有相关的资源，并且生成新的order。
   */
  const region = body.region_id || 'RegionOne';
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
    region: body.region_id || 'RegionOne',
  };

  const endpointObj = await service.getTokenAndEndpoint(query);
  
  const resources = await service.getFullResources(module, tag, region, rest);

  let instance;
  const keyFields = `${tag}s`;
  if (resources && resources[keyFields]) {
    instance = await ctx.model.Product.create({
      "name": body.name,
      "service": body.service || module,
      "region_id": body.region_id,
      "description": body.description,
      "unit_price": JSON.stringify(body.unit_price),
    });
  } else {
    ctx.throw(400, 'Name is invalid!');
  }

  const priceObj = body.unit_price;

  const cachedProjects = {};
  // For each resource. We need to create a new order for it.
  if (resources[keyFields]) {
    const orders = [];
    const deducts = [];
    for (let resource of resources[keyFields]) {
      const opt = await service.generateOption(resource, module, tag, query.region);
      const projectId = await service.getProjectId(resource);
      let projectOpt = cachedProjects[projectId];
      if (!projectOpt) {
        projectOpt = await ctx.model.Project.findProjectWithAccountById(projectId);
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
      attr.product_id = instance.product_id;
      attr.order_id = orderId;
      attr.deduct_id = deductId;
      // await ctx.model.Order.createOrder(attr);
      orders.push(attr);

      deducts.push({
        deduct_id: deductId,
        resource_id: attr.resource_id,
        type: attr.type,
        price: attr.unit_price,
        order_id: orderId
      });
    }

    const p1 = ctx.model.Order.bulkCreate(orders);
    const p2 = ctx.model.Deduct.bulkCreate(deducts);

    await Promise.all([p1, p2]);
  }
  ctx.body = {
    product: instance.toJSON()
  }
};

async function closeOrders(ctx) {

  const params = ctx.params;
  const orders = await ctx.model.Order.findOrderByProductId(params.product_id);

  ctx.body = {};

  let promises = [];
  let promisesIndex = 0;
  const res = [];
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    if (order.deduct_id) {
      const deduct = await ctx.model.Deduct.findOne({
        where: {
          deduct_id: order.deduct_id
        }
      });
      let project = await ctx.model.Project.findOne({
        where: {
          project_id: order.project_id,
        }
      });
      let user = null;
      if (project && project.user_id) {
        user = await ctx.model.Account.findOne({
          where: {
            user_id: project.user_id,
          }
        });
      }
      // Calculate the order's charge and close it.
      promises = promises.concat(ctx.service.utils.order.calOrder(order, deduct, project, user, true));
    }

    res[i] = JSON.parse(JSON.stringify(order.toJSON()));
    delete res[i]['created_at'];
    delete res[i]['updated_at'];
  }

  await Promise.all(promises);
  return res;
}


exports.delete = async(ctx) => {
  if (!ctx.isAdmin) {
    ctx.throw(409);
  }
  const params = ctx.params;
  const targetProducts = await ctx.model.Product.findAll({
    where: params,
  });
  const instance = await ctx.model.Product.destroy({
    where: params,
  });

  if (instance < 1) {
    ctx.throw(404);
  } else {
    await closeOrders(ctx);
    ctx.body = {
      res: 'Done'
    };
  }
}

exports.update = async(ctx) => {
  if (!ctx.isAdmin) {
    ctx.throw(409);
  }
  const params = ctx.params;
  const body = ctx.request.body;
  if (body.unit_price) {
    body.unit_price = JSON.stringify(body.unit_price);
  }

  // Fetch the old product to see if the price is updated.
  const oldProduct = await ctx.model.Product.findOne({
    where: params
  });

  const instance = await ctx.model.Product.update(body, {
    where: params
  });

  if (instance.length > 0) {

    /**
     * 1. Compare the price.
     */

    const oldPrice = await ctx.service.price.calculatePrice(JSON.parse(oldProduct.unit_price), 1);
    const newPrice = await ctx.service.price.calculatePrice(JSON.parse(body.unit_price), 1);
    if (oldPrice != newPrice) {
      /**
       * 2. Scan the orders and close them.
       */
      const newOrders = await closeOrders(ctx);
      const deducts = [];

      /**
       * Create new deduct and orders and change the price.
       */
      for (let i = 0; i < newOrders.length; i++) {
        const deductId = uuidV4();
        const orderId = uuidV4();
        const order = newOrders[i];
        // Remove the unused data.
        delete order.order_id;
        delete order.deduct_id;
        delete order.id;
        order.total_price = 0;
        order.deduct_id = deductId;
        order.order_id = orderId;
        order.unit_price = (order.unit_price) / oldPrice * newPrice;
        delete order.status;
        deducts[i] = {
          deduct_id: deductId,
          resource_id: order.resource_id,
          type: order.type,
          order_id: order.order_id,
          price: order.unit_price,
        };
      }

      const p1 = ctx.model.Order.bulkCreate(newOrders);
      const p2 = ctx.model.Deduct.bulkCreate(deducts);

      await Promise.all([p1, p2]);
    }
    ctx.body = {
      "result": "Done"
    };
  }
}
