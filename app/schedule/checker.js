'use strict';
const uuidV4 = require('uuid/v4');
const chalk = require('chalk');

/**
 * Get order type according to the product name.
 * @param {*String} productName 
 */
function getOrderTypeByProduct(productName) {
  const arr = productName.split(':');
  if (arr.length > 1) {
    return arr[1];
  }
}

function print(...args) {
  console.log(...args);
}

async function operationOrders(ctx, region, product, t,
  projectMap, accountMap, createTime) {
  print(`Start to work on prduct ${product.name}...`);
  const [module, tag, ...rest] = product.name.split(':');
  print(`Find all ${tag} related orders...`);
  const orders = await ctx.model.Order.findAll({
    where: {
      product_id: product.product_id,
      region: region,
      status: 'running',
    },
    transaction: t,
  });
  print(`Found ${orders.length} orders.`);

  print('Group found orders by resource_id...');

  const orderMap = new Map();
  orders.forEach(order => {
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
  });

  orderMap.forEach((value, key, map) => {
    value.sort((a, b) => {
      return a.created_at - b.created_at;
    });
  });

  print(`Group into ${orderMap.size} order groups.`);


  const service = ctx.service.product.getService(ctx, module, tag);

  print(`Find related ${tag} resources...`);
  let resources = await service.getFullResources(module, tag, region, rest);
  const keyFields = `${tag}s`;
  resources = resources[keyFields];
  if (resources) {
    print(`Found ${resources.length} resources.`);
  } else {
    print('Does not find any resources.');
    return;
  }
  const resourceMap = new Map();
  resources.forEach(r => {
    resourceMap.set(r.id, r);
  });
  const toCloseOrders = [];
  const toCreateOrders = [];
  const toCreateDeducts = [];

  const createNewOrder = async(product, resource) => {

    const priceObj = JSON.parse(product.unit_price);
    const opt = await service.generateOption(resource, module, tag, region);
    const body = opt.request;
    const resp = opt.response;
    const amount = await service.getProductAmount(body, opt);
    const price = ctx.service.price.calculatePrice(priceObj, amount);
    const attr = service.getResourceAttribute(body, resp, opt.tag);
    const deductId = uuidV4();
    const orderId = uuidV4();
    const projectId = await service.getProjectId(resource);
    const projectOpt = projectMap.get(projectId);

    attr.unit_price = price;
    attr.region = region;
    attr.project_id = projectId;
    attr.domain_id = projectOpt.domain_id;
    attr.user_id = projectOpt.user_id;
    attr.type = opt.tag;
    attr.product_id = product.product_id;
    attr.order_id = orderId;
    attr.deduct_id = deductId;
    attr.created_at = createTime;
    attr.updated_at = createTime;
    toCreateOrders.push(attr);


    toCreateDeducts.push({
      deduct_id: deductId,
      resource_id: attr.resource_id,
      type: attr.type,
      price: attr.unit_price,
      order_id: orderId,
      updated_at: createTime,
      created_at: createTime,
    });

    return 'Done';
  };

  for (var [key, value] of orderMap) {
    if (resourceMap.has(key)) {
      const resource = resourceMap.get(key)
      /** We can find the resource for the order. */
      const targetResource = resourceMap.get(key);

      if (value.length > 1) {

        print(chalk.red('There are more than one order. Need to remove the unused order!'));
        let realOrder = null;
        value.forEach(o => {
          if (realOrder === null || o.resource_name) {
            realOrder = o;
          }
        });
        value.forEach(o => {
          if (realOrder !== o) {
            rec.mt++;
            toCloseOrders.push(o.order_id);
          }
        });
      } else if (value.length < 1) {

        const projectId = targetResource.tenant_id;
        if (projectId) {
          const project = projectMap.get(projectId);
          if (project && project.user_id) {
            const account = accountMap.get(project.user_id);
            print(chalk.red('No available order? Create new one.'));
            // Create job here:
            await createNewOrder(product, resource);
          }
        }
      }
    } else {

      print(chalk.red(`This is a dirty order, close all: ${key} with ${value.length} orders: ${value.map(r => r.order_id).join(', ')}`));
      value.forEach(r => {
        toCloseOrders.push(r.order_id);
      });
    }
  }


  /** Are there any resources does not have order? */
  for (let j = 0; j < resources.length; j++) {
    const resource = resources[j];
    if (!orderMap.has(resource.id)) {

      const projectId = await service.getProjectId(resource);
      const project = projectMap.get(projectId);
      if (!project) {
        continue;
      }
      const userId = project.user_id;
      const account = accountMap.get(userId);
      if (account && account.level < 9) {

        print(chalk.red(`The resource ${resource.id} does not have an order! Create one.`));
        /** The resource does not have order. create one. */
        await createNewOrder(product, resource);
      }
    }
  }

  print(`===================`);

  return {
    toCloseOrders,
    toCreateDeducts,
    toCreateOrders,
  };

}


/**
 * Checker is used to check the user's balance.
 * Step 1: Collect the user which balance < ${EXE_VALUE}. 
 * Step 2: Check if the user have any expense.
 * Step 3: List all users in step 2.
 * Step 4: Call the callback URL to report all users.
 * (Future feature:)
 * Step 5: Call the callback URL to user for the balance issue.
 * Step 6: Kill the resource if user still not response.
 */
module.exports = app => {
  return {
    schedule: {
      cron: `0 * * * *`,
      type: 'worker',
      disable: true,
    },
    async task(ctx) {
      const t = await ctx.app.model.transaction({
        autocommit: false
      });

      print('Find all products for use...');
      const products = await ctx.model.Product.findAll({
        transaction: t,
      });
      print(`Found ${products.length} products.`);

      print(`Find all regions...`);
      let regions = [];
      const tokenObj = await ctx.service.token.getToken();
      const keystone = tokenObj.endpoint.keystone;
      const keykst = Object.keys(keystone)[0];

      const res = await ctx.curl(`${keystone[keykst]}/regions`, {
        method: 'GET',
        dataType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': tokenObj.token,
        },
        timeout: 20000,
      });
      const regionData = res.data;
      if (regionData.regions) {
        regions = regionData.regions.map(r => r.id);
      }
      print(`Found ${regions.length} regions`);

      const projectMap = await ctx.model.Project.listProductMap(t);
      const accountMap = await ctx.model.Account.listAccountMap(t);

      const createTime = Math.round(Date.now(), 1000) * 1000;
      let toDelete = [];
      let newDeduct = [];
      let newOrder = [];

      const productKeys = [];

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        productKeys[i] = product.product_id;
        for (let idx = 0; idx < regions.length; idx++) {
          const region = regions[idx];
          const o = await operationOrders(ctx, region, product, t,
            projectMap, accountMap, createTime);
          if (!o) {
            continue;
          }
          toDelete = toDelete.concat(o.toCloseOrders);
          newDeduct = newDeduct.concat(o.toCreateDeducts);
          newOrder = newOrder.concat(o.toCreateOrders);
        }
      }

      print('Updating data...');

      await ctx.model.Order.update({
        updated_at: createTime,
        status: 'deleted',
      }, {
        where: {
          product_id: {
            $notIn: productKeys,
          },
        },
        transaction: t,
      });

      await ctx.model.Order.update({
        updated_at: createTime,
        status: 'deleted',
      }, {
        where: {
          order_id: {
            $in: toDelete,
          },
        },
        transaction: t,
      });
      // Create orders:
      await ctx.model.Order.bulkCreate(newOrder, {
        transaction: t,
      });

      // Create deducts:
      await ctx.model.Deduct.bulkCreate(newDeduct, {
        transaction: t,
      });

      await t.commit();

      print('All Done!');
    }
  };
};