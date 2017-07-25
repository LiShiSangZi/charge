'use strict';

/**
 * This is used to fix the data issue of router.
 * It will close all router order and create new one.
 */
const chalk = require('chalk');
const mock = require('egg-mock');
const region = process.argv[2];
if (region) {
  console.log('update router orders in "' + region + '".');
} else {
  console.log(chalk.red('Failed to excute script since argument region is null!'
                        + '\nyou can do like "npm run fix-router RegionOne"'));
  process.exit(1);
}

const exec = async() => {

  const app = mock.app();

  await app.ready();
  await app.model.sync();
  const ctx = app.mockContext();
  const t = await ctx.app.model.transaction();

  const name = await ctx.service.neutron.router.getProductName('neutron', 'router');
  const product = await ctx.model.Product.findProduct(region, name);

  if (!product) {
    return console.log('no product of router.');
  }
  // Step1: Close all the router's order.
  ctx.params = ctx.params || {};
  ctx.params.product_id = product.product_id;

  const toHandleOrders = await ctx.model.Order.findOrderByProductId(product.product_id);
  ctx.logger.info(toHandleOrders.length + ' running router orders will be closed...');

  const oldOrders = await ctx.service.product.closeOrders(ctx, t);

  const deletedOrders = oldOrders.filter(s => s.status === 'deleted');
  const deletedOrderIds = oldOrders.map(s => s.order_id);
  const deleted = toHandleOrders.reduce((p, s) => {
    return p && (deletedOrderIds.indexOf(s.order_id) > -1);
  }, true);
  if (deleted) {
    ctx.logger.info('all running router orders have been closed!');
  } else {
    await t.rollback();
    ctx.logger.warn('excuted rollback, since running router orders have not been closed totally.');
    process.exit(0);
  }

  const rids = [...new Set(deletedOrders.map(s => s.resource_id))];
  ctx.logger.info('after clarified, ' + rids.length + ' orders of resources should be created next...');

  // Step2: Create new order according to the user's resource.
  const body = {
    region_id: region,
    unit_price: JSON.parse(product.unit_price),
    product_id: product.product_id,
  };

  const [module, tag, ...rest] = product.name.split(':');
  const resources = await ctx.service.product.buildOrders(ctx, body, module, tag, rest, t);

  const newOrders = resources.orders;
  const _rids = newOrders.map(s => s.resource_id);
  const created = rids.reduce((p, s) => {
    return p && (_rids.indexOf(s) > -1);
  }, true);
  if (created) {
    ctx.logger.info('all orders have been created successfully!');
  } else {
    await t.rollback();
    ctx.logger.warn('excuted rollback, since some orders have not been created.');
    process.exit(0);
  }

  await t.commit();
  return resources;
};

const run = exec().then(r => {
  console.log('done.');
  process.exit(0);
}).catch(f => {
  console.error(f);
  process.exit(1);
});
