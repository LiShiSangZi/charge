'use strict';

const ModelBase = require('../utils/model_base');

const hooks = new ModelBase();
module.exports = app => {
  const {
    STRING,
    INTEGER,
    UUID,
    BOOLEAN,
    DECIMAL,
    ENUM,
    BIGINT,
  } = app.Sequelize;
  return app.model.define('account', {
    id: {
      type: INTEGER,
      length: 11,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: UUID,
    balance: {
      type: DECIMAL(20, 4),
      defaultValue: 0
    },
    /** 用户的正常余额，不包含赠送。 */
    consumption: {
      type: DECIMAL(20, 4),
      defaultValue: 0
    },
    /** 用户的总消费 */
    currency: {
      type: STRING(64),
      defaultValue: 'CNY'
    },
    /** 货币名称 */
    level: {
      type: INTEGER(11),
      defaultValue: 0,
    },
    /** 用户等级。后续用户的等级不同，扣费的逻辑也会有所不同。 */
    owed: {
      type: BOOLEAN,
      defaultValue: false
    },
    /** 指示用户是否已经欠费。 */
    domain_id: UUID,
    inviter: STRING(64),
    /** 邀请人，方便后期管理。 */
    charged: {
      type: DECIMAL(20, 4),
      defaultValue: 0
    },
    /** 用户充值的金额 */
    reward_value: {
      type: DECIMAL(20, 4),
      defaultValue: 0
    },
    /** 赠送余额。所有非充值流入的资金。用户无法提现。 */
    sales_id: UUID,
    status: {
      type: ENUM('active', 'deactive', 'deleted'),
      defaultValue: 'active'
    },
    frozen_balance: {
      type: DECIMAL(20, 4),
      defaultValue: 0
    },
    /** 冻结余额。方便后期管理。 */
    created_at: BIGINT,
    updated_at: BIGINT,
  }, {
    timestamps: false,
    freezeTableName: true,
    tableName: "account",
    charset: "utf8",
    indexes: [{
      fields: ["user_id"]
    }],
    classMethods: {
      /**
       * Get account by userId.
       */
      async getAccountById(id) {
        return await this.findOne({
          where: {
            user_id: id,
          }
        }, {
          attributes: [
            'user_id', 'balance', 'consumption', 'currency', 'level',
            'owed', 'domain_id', 'inviter', 'charged', 'reward_value',
            'sales_id', 'status', 'frozen_balance'
          ],
        });
      },
      async listAccounts() {
        return await this.findAll({
          attributes: [
            'user_id', 'balance', 'consumption', 'currency', 'level',
            'owed', 'domain_id', 'inviter', 'charged', 'reward_value',
            'sales_id', 'status', 'frozen_balance'
          ],
        });
      },
      /**
       * List the product and output as a Map according by the project id.
       */
      async listAccountMap() {
        const accounts = await this.findAll({
          where: {
            status: 'active',
          },
        });

        const accountMap = new Map();

        accounts.forEach(account => {
          accountMap.set(account.user_id, account);
        });

        return accountMap;
      }
    },
    hooks: hooks.toJSON(),
  });
};