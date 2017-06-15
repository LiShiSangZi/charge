'use strict';

const ModelBase = require('../utils/model_base');

const hooks = new ModelBase();
/**
 * Saved the meta data for order. 
 * When an order is created, will save additonal information here.
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
  return app.model.define('orderMeta', {
    id: {
      type: INTEGER,
      length: 11,
      primaryKey: true,
      autoIncrement: true
    },
    resource_id: {
      type: UUID,
      required: true,
    },
    order_id: {
      type: UUID,
      required: true,
    },
    name: STRING(255),
    type: STRING(255),
    value: STRING(255),
    created_at: BIGINT,
    updated_at: BIGINT,
  }, {
    timestamps: false,
    freezeTableName: true,
    tableName: "orderMeta",
    charset: "utf8",
    indexes: [{
      fields: ["resource_id", "order_id"]
    }],
    classMethods: {
      findByResourceIds(resourceIds) {
        return this.findAll({
          where: {
            resource_id: {
              $in: resourceIds,
            },
          }
        });
      },
      findByOrderIds(orderId) {
        return this.findAll({
          where: {
            order_id: {
              $in: resourceIds,
            },
          }
        });
      },
      createMeta(data, transaction) {
        console.log(data);
        return;
        return this.bulkCreate(data, {
          transaction: transaction,
        });
      }
    },
    hooks: hooks.toJSON(),
  });
};