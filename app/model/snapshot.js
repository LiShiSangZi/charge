'use strict';

/**
 * Order snapshot. It will be created on every order operation.
 */

const ModelBase = require('../utils/model_base');

const hooks = new ModelBase();

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
    BOOLEAN,
  } = app.Sequelize;

  return app.model.define('snapshot', {
    id: {
      type: INTEGER,
      length: 11,
      primaryKey: true,
      autoIncrement: true
    },
    order_id: {
      type: UUID,
      defaultValue: UUIDV4,
      primaryKey: true,
      unique: true
    },
    resource_id: {
      type: UUID
    },
    deduct_id: {
      type: UUID,
      unique: true
    },
    region: STRING(255),
    resource_name: STRING(255),
    type: STRING(255),
    status: {
      type: ENUM('running', 'deleted'),
    },
    unit_price: DECIMAL(20, 4),
    /** 单价 */
    unit: {
      type: STRING(64),
      defaultValue: 'hour'
    },
    user_id: UUID,
    project_id: UUID,
    domain_id: STRING(255),
    product_id: UUID,
    created: {
      type: BOOLEAN,
      defaultValue: false,
    },
    created_at: BIGINT,
    updated_at: BIGINT,
  }, {
    timestamps: false,
    freezeTableName: true,
    tableName: "snapshot",
    charset: "utf8",
    hooks: hooks.toJSON(),
  });
}