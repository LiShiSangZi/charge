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
    /**
     * Check the power of the account
     * level_binary[1]:该用户不会因为欠费而无法创建资源
     * level_binary[2]:该用户不会在欠费的时候被删资源
     * level_binary[3]:该用户为测试用户
     */
    async checkAccountPower(level) {
      var power = {
        is_allow_out_of_balance_create: true,
        is_ban_out_of_balance_delete: true,
        is_tester: true,
      };

      const level_binary = ("000" + parseInt(level).toString(2)).substr(-3);
      if (level_binary[0] != "1") {
        power.is_allow_out_of_balance_create = false;
      }
      if (level_binary[1] != "1") {
        power.is_ban_out_of_balance_delete = false;
      }
      if (level_binary[2] != "1") {
        power.is_tester = false;
      }

      return power;
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
      if ((o.balance === 0 && o.reward_value === 0) ||
        (o.balance < 0) || (o.reward_value < 0)) {
        // There is no expense.
        // TODO: In third party account system, will post the request if balance is more than 0.
        return await account.save(opt);
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

      return await account.save(opt);
    }
  }
  return AccountService;
};