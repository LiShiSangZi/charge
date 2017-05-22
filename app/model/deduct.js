'use strict';

/*
+------------+---------------+------+-----+---------+----------------+
| Field      | Type          | Null | Key | Default | Extra          |
+------------+---------------+------+-----+---------+----------------+
| id         | int(11)       | NO   | PRI | NULL    | auto_increment |
| req_id     | varchar(255)  | YES  | UNI | NULL    |                |
| deduct_id  | varchar(255)  | YES  |     | NULL    |                |
| type       | varchar(64)   | YES  |     | NULL    |                |
| money      | decimal(20,4) | YES  |     | NULL    |                |
| remark     | varchar(255)  | YES  |     | NULL    |                |
| order_id   | varchar(255)  | YES  |     | NULL    |                |
| created_at | datetime      | YES  |     | NULL    |                |
| start_time | datetime      | YES  |     | NULL    |                |
| cal_time   | datetime      | YES  |     | NULL    |                |
+------------+---------------+------+-----+---------+----------------+
*/

const ATTRIBUTES = [
  'id', 'deduct_id', 'money', 'order_id',
  'created_at', 'updated_at', 'start_time', 'cal_time',
];

const QUERY_ATTR = [
  "updated_at", "remark", "created_at", "money", "price",
  'start_time', 'cal_time',
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
  } = app.Sequelize;

  return app.model.define('deduct', {
    id: {
      type: INTEGER,
      length: 11,
      primaryKey: true,
      autoIncrement: true
    },
    deduct_id: {
      type: UUID,
      defaultValue: UUIDV4,
      primaryKey: true,
      unique: true
    },
    type: STRING(64),
    start_time: DATE,
    /** deduct开始结算的时间 */
    cal_time: DATE,
    /** deduct最后一次结算的时间 */
    money: {
      type: DECIMAL(20, 4),
      defaultValue: 0
    },
    /** dedect的消费金额。 */
    price: {
      type: DECIMAL(20, 4),
      defaultValue: 0
    },
    /** deduct 的单价. */
    remark: STRING(255),
    order_id: {
      type: UUID,
      defaultValue: UUIDV4,
      primaryKey: true
    }
  }, {
    underscored: true,
    freezeTableName: true,
    tableName: "deduct",
    charset: "utf8",
    indexes: [{
      fields: ["order_id", "deduct_id"]
    }],
    classMethods: {
      async listAll() {
        const res = await this.findAll({
          attributes: ATTRIBUTES
        });

        return res;
      },
      async filterByOrder(orderId, limit, offset) {
        return await this.findAndCount({
          attributes: QUERY_ATTR,
          where: {
            order_id: orderId,
          },
          order: [
            ['updated_at', 'DESC']
          ],
          limit: limit,
          offset: offset,
        });
      }
    },
    hooks: {
      beforeUpdate(instance) {
        // console.log(instance);
      },
      afterFind(result) {
        const convert = (instance) => {
          if (!instance.start_time) {
            instance.start_time = instance.created_at;
          }
          if (!instance.cal_time) {
            instance.cal_time = instance.updated_at;
          }
        }
        if (result instanceof Array) {
          result.forEach(convert);
        } else {
          convert(result);
        }
      }
    }
  });
}
