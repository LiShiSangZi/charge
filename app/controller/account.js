'use strict';

exports.detail = async(ctx) => {
  const userId = ctx.params.userId;

  const account = await ctx.app.model.Account.getAccountById(userId);
  account.balance = account.balance.toFixed(4);
  account.consumption = account.consumption.toFixed(4);
  if (!account) {
    ctx.throw(404);
  } else {
    ctx.body = account;
  }
};

exports.charge = async(ctx) => {
  const userId = ctx.params.userId;
  const body = ctx.request.body;
  if (Object.keys(body).length === 1 && body.value) {
    const addValue = parseFloat(body.value, 10);
    if (isNaN(addValue)) {
      ctx.throw(400, 'The value should be a valid number');
      return;
    }
    const account = await ctx.app.model.Account.getAccountById(userId);
    if (!account.balance) {
      account.balance = addValue;
    } else {
      account.balance += addValue;
    }
    // TODO: May need to lock the table.
    account.save();
    ctx.body = {
      "message": "Done",
    };
  } else {
    ctx.throw(400, 'Does not to allow modify any other parameters.');
  }

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
