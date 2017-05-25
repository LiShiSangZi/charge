'use strict';

exports.detail = async(ctx) => {
  const userId = ctx.params.userId;

  const account = await ctx.app.model.Account.getAccountById(userId);
  account.balance = account.balance.toFixed(4);
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
  };

  if (body.type && body.come_from) {
    query.type = body.type;
    query.come_from = body.come_from;
  } else {
    query.operator = ctx.user.id;
  }

  // TODO: May need to lock the table.
  const chargeRec = await ctx.app.model.Charge.create(query);

  if (chargeRec) {
    const account = await ctx.app.model.Account.getAccountById(userId);
    if (!account.balance) {
      account.balance = addValue;
    } else {
      account.balance += addValue;
    }

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
  accounts.forEach(account => {
    account.balance = account.balance.toFixed(4);
    account.consumption = account.consumption.toFixed(4);
  });
  ctx.body = {
    accounts: accounts
  };
};

exports.create = async(ctx) => {
  if (!ctx.isAdmin) {
    ctx.throw(409);
  }
  const body = ctx.request.body;

  ctx.body = {};
};