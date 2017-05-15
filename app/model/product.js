'use strict';

module.exports = app => {
  const {
    STRING,
    INTEGER,
    DATE,
    TEXT,
    UUID,
    UUIDV4,
  } = app.Sequelize;

  return app.model.define('product', {
    id: {
      type: INTEGER,
      length: 11,
      primaryKey: true,
      autoIncrement: true
    },
    product_id: {
      type: UUID,
      defaultValue: UUIDV4,
      primaryKey: true,
      unique: true
    },
    name: {
      type: STRING(255),
      unique: true,
    },
    service: STRING(255),
    region_id: STRING(255),
    description: STRING(255),
    unit_price: TEXT,
    deleted: INTEGER(1)
  }, {
    underscored: true,
    freezeTableName: true,
    tableName: "product",
    charset: "utf8",
    indexes: [{
      fields: ["product_id", "name", "service"]
    }],
    classMethods: {
      async findProduct(region_id, service, name) {
        return await this.findOne({
          where: {
            region_id,
            service,
            name,
          }
        });
      },
      async listAll() {
        const res = await this.findAll({
          attributes: ['product_id', 'name',
            'service', 'region_id', 'description',
            'unit_price', 'created_at', 'updated_at'
          ]
        });

        res.forEach(prod => {
          prod.unit_price = JSON.parse(prod.unit_price);
        });

        return res;
      }
    },
  });
};
