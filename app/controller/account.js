'use strict';

exports.detail = async(ctx) => {
  const userId = ctx.params.userId;

  const account = await ctx.app.model.Account.getAccountById(userId);
  account.balance = await ctx.service.account.getBalance(account);
  account.consumption = account.consumption.toFixed(4);
  if (account.reward_value) {
    account.reward_value = account.reward_value.toFixed(4);
  }
  if (!account) {
    ctx.throw(404);
  } else {
    ctx.body = account;
  }
};

exports.setLevel = async(ctx) => {
  const userId = ctx.params.userId;
  const body = ctx.request.body;
  if (body.level) {
    const level = parseInt(body.level, 10);
    if (level > 0 && level < 10) {
      if (!isNaN(level)) {
        const res = await ctx.app.model.Account.update({
          level: level
        }, {
          where: {
            user_id: userId,
          }
        });
        if (res && res.length > 0) {
          ctx.body = {
            "msg": "Done",
          };
          return;
        }
      }
    }
  }
  ctx.throw(400, "Bad Request!");

};

exports.charge = async(ctx) => {
  const userId = ctx.params.userId;
  const body = ctx.request.body;
  const addValue = parseFloat(body.value, 10);
  if (isNaN(addValue)) {
    ctx.throw(400, 'The value should be a valid number');
    return;
  }

  const query = {
    "amount": addValue,
    "user_id": userId,
    "expired_at": body.expired_at || null,
  };

  query.type = body.type || null;
  if (body.come_from) {
    query.come_from = body.come_from;
  } else {
    query.operator = ctx.user.id;
  }

  // TODO: May need to lock the table.
  const chargeRec = await ctx.app.model.Charge.create(query);

  if (chargeRec) {
    const account = await ctx.app.model.Account.getAccountById(userId);


    if (!account.balance) {
      account.balance = 0;
    }
    account.balance += addValue;
    // await ctx.service.setBalance(account, addValue);

    await ctx.service.account.setAccount(account, {});

    if (query.operator) {
      if (account.reward_value === null) {
        account.reward_value = addValue;
      } else {
        account.reward_value += addValue;
      }
      if (account.reward_value < 0) {
        account.reward_value = 0;
      }
    }
    account.save();
  }
  ctx.body = {
    "message": "Done",
  };

}

exports.list = async(ctx) => {
  const accounts = await ctx.app.model.Account.listAccounts();

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    account.balance = await ctx.service.account.getBalance(account);
    account.consumption = account.consumption.toFixed(4);
  }
  ctx.body = {
    accounts: accounts
  };
};

exports.summarySelect = async(ctx) => {
  const body = ctx.request.body;
  await this.summary(ctx, body.ids, body.start, body.end);
}

exports.summary = async(ctx, ids, startTime, endTime) => {
  const userId = ctx.params.userId;
  let start = parseInt(startTime || ctx.query.start, 10);
  let end = parseInt(endTime || ctx.query.end, 10);
  if (!start || isNaN(start)) {
    start = 0;
  }
  if (!end || isNaN(end)) {
    end = Date.now();
  }

  start = new Date(start);
  end = new Date(end);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  start = start.getTime();
  end = end.getTime();
  if (start >= end) {
    ctx.throw(400);
  }
  let userCondition = '';
  if (userId && userId !== 'summary') {
    userCondition = ` AND o.user_id = :userId`
  }

  if (ids && ids.length > 0) {

    userCondition = `${userCondition} AND o.user_id IN (:ids)`;
  }

  const orders = await ctx.app.model.query(`SELECT o.user_id, o.order_id, o.resource_id, o.type, o.status, o.unit_price, o.total_price, o.region, sum(d.money) as money, min(d.created_at) as start, max(d.updated_at) as end
FROM ${ctx.app.config.sequelize.database}.order o LEFT JOIN deduct d ON d.order_id = o.order_id
WHERE (d.created_at <= :end AND d.updated_at >= :start)${userCondition} AND money > 0
GROUP BY d.order_id
ORDER BY user_id, type, resource_id`, {
    replacements: {
      userId,
      start,
      end,
      ids,
    },
    type: ctx.app.model.QueryTypes.SELECT
  });

  ctx.body = orders;
}

exports.create = async(ctx) => {
  if (!ctx.isAdmin) {
    ctx.throw(409);
  }
  const body = ctx.request.body;

  ctx.body = {};
};