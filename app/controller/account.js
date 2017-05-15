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