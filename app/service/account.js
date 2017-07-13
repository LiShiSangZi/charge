'use strict';

/**
 * This is used to read/write user balance.
 */
module.exports = (app) => {
  class AccountService extends app.Service {
    constructor(ctx) {
      super(ctx);
    }
    async getBalance(account) {
      return account.balance.toFixed(4);
    }

    async setAccount(account, opt) {
      return account.save(opt);
    }
  }
  return AccountService;
};