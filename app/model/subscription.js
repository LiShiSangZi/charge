'use strict';

module.exports = app => {
  const {
    INTEGER,
    DATE,
    BOOLEAN,
    DECIMAL,
    ENUM,
    UUID,
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
  }, {
    underscored: true,
    freezeTableName: true,
    tableName: "subscription",
    charset: "utf8",
  });
};
