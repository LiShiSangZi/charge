'use strict';

/**
 * Gift card model.
 */

const ModelBase = require('../utils/model_base');

const hooks = new ModelBase();

module.exports = app => {
  const {
    DATE,
    DECIMAL,
    INTEGER,
    BOOLEAN,
    ENUM,
    UUID,
    UUIDV4,
    STRING,
    BIGINT,
  } = app.Sequelize;

  return app.model.define('card', {
    id: {
      type: INTEGER,
      length: 11,
      primaryKey: true,
      autoIncrement: true
    },
    card_id: {
      type: UUID,
      defaultValue: UUIDV4,
      allowNull: false,
    },
    expire_date: {
      type: BIGINT,
      allowNull: false,
    },
    amount: {
      type: DECIMAL(20, 4),
      allowNull: false,
      defaultValue: 50,
    },
    used: {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    charge_date: BIGINT,
    charge_id: UUID,
    charge_user: STRING(32),
    created_at: BIGINT,
    updated_at: BIGINT,
  }, {
    timestamps: false,
    freezeTableName: true,
    tableName: "card",
    charset: "utf8",
    indexes: [{
      fields: ["card_id"]
    }],
    hooks: hooks.toJSON(),
  });
};
