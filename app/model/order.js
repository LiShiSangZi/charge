'use strict';
const uuidV4 = require('uuid/v4');
const ModelBase = require('../utils/model_base');



const ATTRIBUTES = ['id', 'order_id', 'resource_name', 'resource_id', 'type', 'status', 'deduct_id', 'region',
  'unit_price', 'unit', 'total_price', 'user_id', 'project_id', 'domain_id',
  'created_at', 'updated_at',
];

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

  const hooks = new ModelBase();

  return app.model.define('order', {
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
    /** 当前在扣费的纪录。有且只有一个。 */
    region: STRING(255),
    resource_name: STRING(255),
    type: STRING(255),
    status: {
      type: ENUM('running', 'deleted'),
      defaultValue: 'running'
    },
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
    /** 消费总额 */
    cron_time: DATE,
    /** 包年包月订单生效时间。如果是实时订单，就是订单创建的时间。 */
    date_time: DATE,
    /** 当前订单的到期时间。如果为包年包月订单，订单会在到期的时候失效。续订会重新生成新订单。如果是实时订单，就是订单最后一次扣费的时间。 */
    renew: INTEGER(1),
    /** 用于包年包月是否自动续约。 */
    renew_method: STRING(64),
    /** 包年包月续约方式。 */
    renew_period: INTEGER(11),
    /** 包年包月周期。 */
    user_id: UUID,
    project_id: UUID,
    domain_id: STRING(255),
    charged: INTEGER(1),
    product_id: UUID,
    owed: INTEGER(1),
    created_at: BIGINT,
    updated_at: BIGINT,
  }, {
    timestamps: false,
    freezeTableName: true,
    tableName: "order",
    charset: "utf8",
    indexes: [{
      fields: ["order_id", "resource_id", "user_id", "project_id"]
    }],
    classMethods: {
      async createOrder(value, transaction) {
        const uuid = uuidV4();
        value.deduct_id = uuid;
        const result = await this.create(value);
        const newOrder = result.dataValues;
        const newDeduct = {
          deduct_id: uuid,
          resource_id: newOrder.resource_id,
          type: newOrder.type,
          order_id: newOrder.order_id,
          price: newOrder.unit_price,
          created_at: newOrder.created_at,
          updated_at: newOrder.created_at,
        };
        if (value.unit === 'realtime') {
          newDeduct.money = newOrder.total_price;
        }
        const defaultDedect = await app.model.Deduct.create(newDeduct, {
          transaction: transaction,
        });
        return newOrder;
      },
      async findOrderByProductId(uuid) {
        return await this.findAll({
          where: {
            product_id: uuid,
            status: 'running',
          }
        });
      },
      async findOrderByResource(uuid, region) {
        return await this.findAll({
          where: {
            resource_id: uuid,
            region: region,
            status: 'running',
          }
        });
      },
      async findAllOrderByResource(uuid) {
        return await this.findAll({
          where: {
            resource_id: uuid,
          },
          order: [
            ['created_at', 'DESC'],
            ['updated_at', 'DESC']
          ],
        });
      },
      async findAndCounts(opt, limit, offset, t) {
        opt.type = {
          $not: 'router-archive',
        };
        return await this.findAndCount({
          attributes: ATTRIBUTES,
          limit: limit,
          offset: offset,
          where: opt,
          order: [
            ['created_at', 'DESC'],
            ['updated_at', 'DESC']
          ],
          transaction: t,
        });
      },
      async findAllOrder(o) {
        if (!o) {
          o = {};
        }
        o.attributes = ATTRIBUTES;
        return await this.findAll(o);
      },
      async isYourOrder(orderId, userId) {
        const order = await this.findOne({
          where: {
            user_id: userId,
            order_id: orderId,
          }
        });
        return order != null;
      },
      /**
       * Build the order by id.
       */
      async buildOrderDict() {
        const res = await this.findAllOrder({
          where: {
            unit: {
              $ne: 'realtime',
            }
          }
        });
        const dict = {};
        res.forEach(order => {
          dict[order.order_id] = order;
        });
        return dict;
      },
      async listAll() {
        const res = await this.findAllOrder();
        return res;
      }
    },
    hooks: hooks.toJSON(),
  });
};