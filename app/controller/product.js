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

  const t = await ctx.app.model.transaction();

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
  const resources = await ctx.service.product.buildOrders(ctx, body, module, tag, rest, t);
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
    }, {
      transaction: t,
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

exports.delete = async(ctx) => {
  if (!ctx.isAdmin) {
    ctx.throw(409);
  }
  const params = ctx.params;
  const t = await ctx.app.model.transaction();

  const instance = await ctx.model.Product.destroy({
    where: params,
    transaction: t,
  });

  if (instance < 1) {
    ctx.throw(404);
    // Close the transaction. Actually nothing changed.
    t.commit();
  } else {
    await ctx.service.product.closeOrders(ctx, t);
    // Commit the data.
    // t.commit();

    setTimeout(() => {
      t.commit();
    }, 10000);
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

  const t = await ctx.app.model.transaction();
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
      const newOrders = await ctx.service.product.closeOrders(ctx, t);
      body.unit_price = JSON.parse(body.unit_price);
      body.product_id = params.product_id;
      const resources = await ctx.service.product.buildOrders(ctx, body, module, tag, rest, t);
    }

    t.commit();
    ctx.body = {
      "result": "Done"
    };
    return;
  }
}
