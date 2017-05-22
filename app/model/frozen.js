'use strict';

const modelBase = require('../utils/model_base');
/**
 * 每次用户提交请求前，都会临时去冻结用户的资金。冻结资金会在一定时间后自动解冻。
 */

module.exports = app => {
  const {
    STRING,
    INTEGER,
    DATE,
    DECIMAL,
    ENUM,
    UUID,
    UUIDV4,
    BIGINT,
  } = app.Sequelize;

  return app.model.define('frozen', {
    id: {
      type: INTEGER,
      length: 11,
      primaryKey: true,
      autoIncrement: true
    },
    frozen_id: {
      type: UUID,
      defaultValue: UUIDV4,
      primaryKey: true,
      unique: true
    },
    region: STRING(255),
    type: STRING(255),
    unit_price: DECIMAL(20, 4),
    /** 单价 */
    unit: {
      type: STRING(64),
      defaultValue: 'hour'
    },
    /** 计价单位 */
    total_price: {
      type: DECIMAL(20, 4),
      defaultValue: 0
    },
    project_id: UUID,
    domain_id: STRING(255),
    product_id: UUID,
    request_id: UUID,
    user_id: UUID,
    created_at: BIGINT,
    updated_at: BIGINT,
  }, {
    timestamps: false,
    freezeTableName: true,
    tableName: "frozen",
    charset: "utf8",
    indexes: [{
      fields: ["frozen_id", "request_id"]
    }],
    classMethods: {
      async findByRequestId(requestId) {
        return this.findOne({
          where: {
            request_id: requestId,
          }
        });
      }
    },
    hooks: modelBase,
  });
};
