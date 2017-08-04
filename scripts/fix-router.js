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
  const t = await ctx.app.model.transaction({autocommit: false});
  const name = await ctx.service.neutron.router.getProductName('neutron', 'router');
  const product = await ctx.model.Product.findProduct(region, name);
  const toHandleOrders = await ctx.model.Order.findOrderByProductId(product.product_id);

  const toReturnMoney = {};
  const toDeleteOrders = []; let count = 0;
  toHandleOrders.forEach(s => {
    if (!s.resource_name) {
      toReturnMoney[s.user_id] = toReturnMoney[s.user_id] || 0;
      if (s.total_price > 0) {
        toReturnMoney[s.user_id] += s.total_price;
      }
      toDeleteOrders.push(s.order_id);
    }
  });

  try {
    console.log('delete all ' + toDeleteOrders.length + ' invalid orders...');
    const num1 = await ctx.model.Order.destroy({
      where: {
        order_id: toDeleteOrders,
      },
      transaction: t,
    });
    console.log(num1 + ' deleted.');

    console.log('delete all invalid deducts releted to above orders...');
    const num2 = await ctx.model.Deduct.destroy({
      where: {
        order_id: toDeleteOrders,
      },
      transaction: t,
    });
    console.log(num2 + ' deleted.');

    const now = Date.now();
    for (let user_id of Object.keys(toReturnMoney)) {
      if (user_id && toReturnMoney[user_id]) {

        console.log('update account of ' + user_id + ' ...');
        await ctx.model.Account.update({
          reward_value: ctx.model.Sequelize.literal('`reward_value` + ' + toReturnMoney[user_id]),
          consumption: ctx.model.Sequelize.literal('`consumption` - ' + toReturnMoney[user_id]),
          balance: ctx.model.Sequelize.literal('`balance` + ' + toReturnMoney[user_id]),
          updated_at: now,
        }, {
          where: {user_id: user_id},
          transaction: t,
        });
        console.log('updated.');

        console.log('create compensation charge of ' + user_id + ' ...');
        await ctx.model.Charge.create({
          come_from: 'system',
          // operator: '',
          user_id: user_id,
          type: 'compensation',
          // expired: '',
          // consumption: '',
          amount: toReturnMoney[user_id],
          created_at: now,
          updated_at: now,
        }, {
          transaction: t,
        });
        console.log('created.');
      }
    };

    await t.commit();
  } catch (e) {
    await t.rollback();
    throw e;
  }

};

const run = exec().then(r => {
  console.log('done.');
  process.exit(0);
}).catch(f => {
  console.error(f);
  process.exit(1);
});
