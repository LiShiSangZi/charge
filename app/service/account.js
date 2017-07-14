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
      const resultData = account.dataValues;
      const prevData = account._previousDataValues;
      const t = opt.transaction;

      const o = {
        "user_id": resultData.user_id,
        "balance": resultData.balance - prevData.balance,
        "reward_value": resultData.reward_value - prevData.reward_value,
      };
      if (o.balance === 0 && o.reward_value === 0) {
        return;
      }
      const charges = await this.ctx.model.Charge.fetchExpiredChargeList(o.user_id, t);

      for (let i = 0; i < charges.length && (o.balance < 0 || o.reward_value < 0); i++) {
        const charge = charges[i];

        const left = charge.amount - charge.consumption;
        if (!charge.come_from && charge.operator) {
          // This is a pure reward value.
          const update = Math.min(left, -o.reward_value);
          charge.consumption += update;
          o.reward_value += update;
          o.balance += update;
        } else {
          const update = Math.min(left, -o.balance);
          charge.consumption += update;
          o.balance += update;
        }

        if (charge.amount <= charge.consumption) {
          charge.expired = 'Y';
        }

        await charge.save({
          transaction: t,
        });
      }

      return account.save(opt);
    }
  }
  return AccountService;
};