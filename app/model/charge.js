'use strict';

/**
 * Charge model for the user or system.
 */
'use strict';

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
    user_id: {
      type: UUID,
      defaultValue: UUIDV4,
      primaryKey: true,
      required: true
    },
    type: STRING(255),
    amount: DECIMAL(20, 4),
  }, {
    underscored: true,
    freezeTableName: true,
    tableName: "charge",
    charset: "utf8",
    indexes: [{
      fields: ["charge_id", "user_id"]
    }],
    classMethods: {
      
    }
  });
};
