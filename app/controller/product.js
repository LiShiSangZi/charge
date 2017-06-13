'use strict';
const uuidV4 = require('uuid/v4');

exports.list = async(ctx) => {
  const products = await ctx.model.Product.listAll();
  ctx.body = products;
}
exports.detail = async(ctx) => {
  const products = await ctx.model.Product.listAll();
  products.forEach(product => {
    if (product.unit_price && product.unit_price.price &&
      typeof product.unit_price.price.segmented === 'undefined') {
      product.unit_price.price.segmented = [];
    }
  });
  ctx.body = {
    "products": products,
    "total_count": products.length,
  };
}

exports.create = async(ctx) => {
  if (!ctx.isAdmin) {
    ctx.throw(409);
  }

  const t = await app.model.transaction();

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
      if (tag === 'volume') {
        ctx.throw(400, 'You need to speicific the volume type.');
      }
    }
  }
  const productId = uuidV4();
  body.product_id = productId;
  const resources = await buildOrders(ctx, body, module, tag, rest, t);
  let instance;
  const keyFields = `${tag}s`;
  if (resources && resources[keyFields]) {
    instance = await ctx.model.Product.create({
      "product_id": productId,
      "name": body.name,
      "service": body.service || module,
      "region_id": body.region_id,
      "description": body.description,
      "unit_price": JSON.stringify(body.unit_price),
    });
  } else {
    ctx.throw(400, 'Name is invalid!');
    t.rollback();
  }
  t.commit();
  ctx.body = {
    product: instance.toJSON()
  }

};

exports.showPrice = async(ctx) => {
  const billingMethod = ctx.query['purchase.billing_method'];
  let index = 0;
  const productQuery = [];
  let productName = ctx.query[`purchase.purchases[${index}].product_name`];
  while (productName) {
    productQuery[index] = {
      "name": productName,
      "regionId": ctx.query[`purchase.purchases[${index}].region_id`],
      "quantity": parseInt(ctx.query[`purchase.purchases[${index}].quantity`], 10),
    }
    index++;
    productName = ctx.query[`purchase.purchases[${index}].product_name`];
  }

  const products = await ctx.model.Product.listAll();

  const qMatrix = {};

  const res = products.filter(prod => {
    if (billingMethod !== undefined && prod.unit !== billingMethod) {
      return false;
    }
    if (productQuery.length < 1) {
      return true;
    }
    const r = productQuery.find((ele) =>
      (ele.name === prod.name && ele.regionId === prod.region_id));
    if (r) {
      qMatrix[prod.product_id] = r.quantity;
      return true;
    }
    return false;
  }).map(prod => {
    const q = qMatrix[prod.product_id];
    const price = parseFloat(prod.unit_price.price.base_price);
    return {
      "total_price": ctx.service.price.calculatePrice(prod.unit_price, q),
      "unit": prod.unit,
      "unit_price": prod.unit_price,
    };
  });
  if (res instanceof Array && res.length === 1) {
    ctx.body = res[0];
    return;
  }
  ctx.body = res;
};

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
      await user.save(addOpt);
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

    await Promise.all([p1, p2]);
  }
  return resources;
}


exports.delete = async(ctx) => {
  if (!ctx.isAdmin) {
    ctx.throw(409);
  }
  const params = ctx.params;
  const t = await app.model.transaction();

  const instance = await ctx.model.Product.destroy({
    where: params,
    transaction: t,
  });

  if (instance < 1) {
    ctx.throw(404);
    // Close the transaction. Actually nothing changed.
    t.commit();
  } else {
    await closeOrders(ctx, t);
    // Commit the data.
    t.commit();
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

  const t = await app.model.transaction();
  // Fetch the old product to see if the price is updated.
  const oldProduct = await ctx.model.Product.findOne({
    where: params,
    transaction: t,
  });

  const instance = await ctx.model.Product.update(body, {
    where: params,
    transaction: t,
  });

  if (instance.length > 0) {

    /**
     * 1. Compare the price.
     */
    const oldPrice = await ctx.service.price.calculatePrice(JSON.parse(oldProduct.unit_price), 1);
    const newPrice = await ctx.service.price.calculatePrice(JSON.parse(body.unit_price), 1);
    if (oldPrice != newPrice) {

      const name = oldProduct.name;
      const [module, tag, ...rest] = name.split(':');
      /**
       * 2. Scan the orders and close them.
       */
      const newOrders = await closeOrders(ctx, t);
      body.unit_price = JSON.parse(body.unit_price);
      body.product_id = params.product_id;
      const resources = await buildOrders(ctx, body, module, tag, rest, t);
    }
    t.commit();
    ctx.body = {
      "result": "Done"
    };
    return;
  }
}
