'use strict';

const ModelBase = require('../utils/model_base');

const hooks = new ModelBase();

module.exports = app => {
  const {
    INTEGER,
    DATE,
    BOOLEAN,
    DECIMAL,
    ENUM,
    UUID,
    BIGINT,
  } = app.Sequelize;
  return app.model.define('subscription', {
    id: {
      type: INTEGER,
      length: 11,
      primaryKey: true,
      autoIncrement: true
    },
    start_time: DECIMAL,
    end_time: DECIMAL,
    total_deduct: DECIMAL(20, 4),
    order_deduct: DECIMAL(20, 4),
    price: DECIMAL(20, 4),
    order_id: UUID,
    deduct_id: UUID,
    created_at: BIGINT,
    updated_at: BIGINT,
  }, {
    timestamps: false,
    freezeTableName: true,
    tableName: "subscription",
    charset: "utf8",
    hooks: hooks.toJSON(),
  });
};
