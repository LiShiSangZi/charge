'use strict';

/**
 * Charge model for the user or system.
 */

const ModelBase = require('../utils/model_base');

const hooks = new ModelBase();
/**
 * 每次用户提交请求前，都会临时去冻结用户的资金。冻结资金会在一定时间后自动解冻。
 */

module.exports = app => {
  const {
    DATE,
    DECIMAL,
    INTEGER,
    ENUM,
    UUID,
    UUIDV4,
    STRING,
    BIGINT,
  } = app.Sequelize;

  return app.model.define('charge', {
    id: {
      type: INTEGER,
      length: 11,
      primaryKey: true,
      autoIncrement: true
    },
    charge_id: {
      type: UUID,
      defaultValue: UUIDV4,
      primaryKey: true,
      unique: true
    },
    come_from: STRING(255),
    operator: {
      type: UUID,
      primaryKey: true,
    },
    user_id: {
      type: UUID,
      defaultValue: UUIDV4,
      primaryKey: true,
      required: true
    },
    type: STRING(255),
    expired: {
      type: ENUM('Y', 'N'),
      defaultValue: 'N',
    },
    amount: DECIMAL(20, 4),
    created_at: BIGINT,
    updated_at: BIGINT,
    expired_at: BIGINT,
  }, {
    timestamps: false,
    freezeTableName: true,
    tableName: "charge",
    charset: "utf8",
    indexes: [{
      fields: ["charge_id", "user_id"]
    }],
    classMethods: {
      fetchCharge(id, type, limit, offset) {
        const where = {
          user_id: id,
        };
        if (type) {
          where.type = type;
        }
        return this.findAndCount({
          limit: limit,
          offset: offset,
          where: where,
          order: [
            ['created_at', 'DESC'],
            ['updated_at', 'DESC']
          ],
        });
      }
    },
    hooks: hooks.toJSON(),
  });
};
