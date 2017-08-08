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
  const serverProducts = [];
  products.forEach(prod => {
    prodMap.set(prod.product_id, prod);
    if (/nova\:server/.test(prod.name)) {
      serverProducts.push(prod);
    }
  });
  if (serverProducts.length < 1) {
    console.log(`The router is free in this region!`);
    t.rollback();
    return;
  }
  console.log('Find all server related orders...');
  const serverOrders = await ctx.model.Order.findAll({
    where: {
      type: 'server',
      status: 'running',
    },
    transaction: t,
  });
  console.log(`Found ${serverOrders.length} orders`);
  console.log('Group found orders by resource_id...');
  const orderMap = new Map();
  
  for (let i = 0; i < serverOrders.length; i++) {
    const order = serverOrders[i];
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
      
    } else {
      value.sort((a, b) => {
        return a.created_at - b.created_at;
      });
    }
  });

  console.log(`Group into ${orderMap.size} order groups.`);

  const tokenObj = await ctx.service.token.getToken();
  const endpoint = tokenObj.endpoint['nova'][region];
  const res = await ctx.curl(`${endpoint}/servers/detail?all_tenants=True`, {
    method: 'GET',
    dataType: 'json',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': tokenObj.token,
    },
    timeout: 20000,
  });
  if (!res.data || !res.data.servers || res.data.servers.length < 1) {
    console.log('There is no available servers. Exiting!');
    return;
  }
  console.log(`Found ${res.data.servers.length} servers.`);
  const servers = res.data.servers;
  const serverObjMap = new Map();
  const projectMap = await ctx.model.Project.listProductMap();
  const accountMap = await ctx.model.Account.listAccountMap(t);
  const createTime = Math.round(Date.now(), 1000) * 1000;
  servers.forEach(r => {
    if (!orderMap.has(r.id)) {
      const projectId = r['tenant_id'];
      if (projectMap.has(projectId)) {
        const project = projectMap.get(projectId);
        const userId = project.user_id;
        const user = accountMap.get(userId);
        if (user && user.level < 9) {
          console.log(userId, r.id, r.created, r.flavor.id);
        }
      }
    }
    serverObjMap.set(r.id, r);
  });


  await t.commit();

};

const run = exec().then(r => {
  console.log('done.');
  process.exit(0);
}).catch(f => {
  console.error(f);
  process.exit(1);
});