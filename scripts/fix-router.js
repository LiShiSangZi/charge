'use strict';

const chalk = require('chalk');
const mock = require('egg-mock');
const uuidV4 = require('uuid/v4');

const region = process.argv[2];
if (region) {
  console.log('update router orders in "' + region + '".');
} else {
  console.log(chalk.red('Failed to excute script since argument region is null!' +
    '\nyou can do like "npm run fix-router RegionOne"'));
  process.exit(1);
}

const exec = async() => {

  const app = mock.app();

  await app.ready();
  await app.model.sync();
  const ctx = app.mockContext();
  const t = await ctx.app.model.transaction({
    autocommit: false
  });

  console.log('Find all products for use...');
  const products = await ctx.model.Product.findAll({
    transaction: t,
  });
  console.log(`Found ${products.length} products.`);
  const prodMap = new Map();
  let routerProduct;
  products.forEach(prod => {
    prodMap.set(prod.product_id, prod);
    if (prod.name === 'neutron:router') {
      routerProduct = prod;
    }
  });
  if (!routerProduct) {
    console.log(`The router is free in this region!`);
    t.rollback();
    return;
  }
  console.log('Find all router related orders...');
  const routerOrders = await ctx.model.Order.findAll({
    where: {
      type: 'router',
      status: 'running',
    },
    transaction: t,
  });
  console.log(`Found ${routerOrders.length} orders`);
  console.log('Group found orders by resource_id...');
  const orderMap = new Map();
  for (let i = 0; i < routerOrders.length; i++) {
    const order = routerOrders[i];
    let sx = order.resource_id;
    if (!order.resource_id) {
      sx = '-';
    }
    const s = orderMap.get(sx)
    if (!s) {
      orderMap.set(sx, [order]);
    } else {
      s.push(order);
    }
  }
  orderMap.forEach((value, key, map) => {
    if (value.length < 2 && key !== '-') {
      map.delete(key);
    } else {
      value.sort((a, b) => {
        return a.created_at - b.created_at;
      });
    }
  });
  console.log(orderMap);
  console.log(`Group into ${orderMap.size} order groups.`);

  const tokenObj = await ctx.service.token.getToken();
  const endpoint = tokenObj.endpoint['neutron'][region];
  const res = await ctx.curl(`${endpoint}/routers`, {
    method: 'GET',
    dataType: 'json',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': tokenObj.token,
    },
    timeout: 20000,
  });
  if (!res.data || !res.data.routers || res.data.routers.length < 1) {
    console.log('There is no available routers. Exiting!');
    return;
  }
  const routers = res.data.routers;
  const routerObjMap = new Map();
  routers.forEach(r => {
    routerObjMap.set(r.id, r);
  });
  const projectMap = await ctx.model.Project.listProductMap();
  const toCloseOrders = [];
  const toCreateOrders = [];
  const toCreateDeducts = [];
  const createTime = Math.round(Date.now(), 1000) * 1000;
  const routerPrice = ctx.service.price.calculatePrice(JSON.parse(routerProduct.unit_price), 1);

  const createNewOrder = (o) => {
    const newOrder = Object.assign({}, o);
    delete newOrder['id'];

    const deductId = uuidV4();
    const orderId = uuidV4();

    newOrder.order_id = orderId;
    newOrder.deduct_id = deductId;
    newOrder.unit_price = routerPrice;
    newOrder.total_price = 0;
    newOrder.product_id = routerProduct.product_id;

    toCreateOrders.push(newOrder);
    toCreateDeducts.push({
      "deduct_id": deductId,
      "type": newOrder.type,
      "money": 0,
      "price": newOrder.unit_price,
      "order_id": orderId,
      "created_at": createTime,
      "updated_at": createTime,
    });

    return {
      "order": newOrder,
      "deduct": null,
    };
  };
  const rec = {
    "wp": 0,
    /** The product id is wrong. */
    "mt": 0,
    /** There are more than one ordres. */
    "iv": 0,
    /** The resource is not exist. */
  };
  const invalidResource = [];
  orderMap.forEach((value, key) => {
    if (routerObjMap.has(key)) {
      const targetRouter = routerObjMap.get(key);

      const left = value.filter(r => {
        const productId = r.product_id;
        if (productId !== routerProduct.product_id) {
          rec.wp++;
          toCloseOrders.push(r.order_id);
          return false;
        }
        return true;
      });
      if (left.length > 1) {

        console.log('There are more than one order. Need to remove the unused order!');
        let realOrder = null;
        left.forEach(o => {
          if (realOrder === null || o.resource_name) {
            realOrder = o;
          }
        });
        left.forEach(o => {
          if (realOrder !== o) {
            rec.mt++;
            toCloseOrders.push(o.order_id);
          }
        });
      } else if (left.length < 1) {

        const projectId = targetRouter.tenant_id;
        if (projectId) {
          const project = projectMap.get(projectId);
          if (project && project.user_id) {
            console.log('No available order? Create new one.');
            // Create job here:
            createNewOrder({
              "id": 1,
              "resource_id": targetRouter.id,
              "region": region,
              "resource_name": targetRouter.name,
              "type": "router",
              "status": "running",
              "user_id": project.user_id,
              "project_id": project.project_id,
              "domain_id": project.domain_id,
            });
          }
        }
      }
    } else {

      console.log(`This is a dirty order, close all: ${key} with ${value.length} orders`);
      value.forEach(r => {
        console.log(r.resource_id, r.order_id);
        rec.iv++;
        invalidResource.push({
          "resource_id": r.resource_id,
          "resource_name": r.resource_name,
          "order_id": r.order_id,
          "product_id": r.product_id,
          "status": r.status,
          "type": r.type,
        });
        toCloseOrders.push(r.order_id);
      });
    }
  });
  console.log('All Done!');
  console.log(`The product id is wrong: ${rec.wp}`);
  console.log(`There are more than one ordres: ${rec.mt}`);
  console.log(`The resource is not exist: ${rec.iv}`);
  console.log(toCloseOrders);
  console.log(toCreateOrders.length);
  console.log(toCreateDeducts.length);

  // Close orders:
  // console.log(toCloseOrders);

  await ctx.model.Order.update({
    updated_at: createTime,
    status: 'deleted',
    type: 'router-archive',
  }, {
    where: {
      order_id: {
        $in: toCloseOrders,
      },
    },
    transaction: t,
  });

  // Create orders:
  await ctx.model.Order.bulkCreate(toCreateOrders, {
    transaction: t,
  });

  // Create deducts:
  await ctx.model.Deduct.bulkCreate(toCreateDeducts, {
    transaction: t,
  });



  // await this.bulkCreate(data, {
  //         transaction: transaction,
  //       });

  await t.commit();

};

const run = exec().then(r => {
  console.log('done.');
  process.exit(0);
}).catch(f => {
  console.error(f);
  process.exit(1);
});