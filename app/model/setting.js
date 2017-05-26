'use strict';

/**
 * Save the charge settings as key/value.
 */

const ModelBase = require('../utils/model_base');

const hooks = new ModelBase();

const MEM_TOKEN = 'x_charge_setting';

module.exports = app => {
  const {
    STRING,
    INTEGER,
    UUID,
    BOOLEAN,
    DECIMAL,
    ENUM,
    BIGINT,
  } = app.Sequelize;
  return app.model.define('setting', {
    id: {
      type: INTEGER,
      length: 11,
      primaryKey: true,
      autoIncrement: true
    },
    key: {
      type: STRING(64),
      unique: true,
    },
    value: {
      type: STRING(64),
    },
    type: {
      type: ENUM('boolean', 'number', 'string'),
      defaultValue: 'string',
    },
    description: {
      type: STRING(64),
    },
  }, {
    timestamps: false,
    freezeTableName: true,
    tableName: "setting",
    charset: "utf8",
    hooks: hooks.toJSON(),
    classMethods: {
      async getSettings() {
        let allKeys = await app.memcached.get(MEM_TOKEN);
        if (typeof allKeys === 'undefined') {
          // Read from DB.
          allKeys = await this.findAll();
          app.memcached.set(MEM_TOKEN, allKeys);
        }
        return allKeys;
      },
      async getSetting(key) {
        const allKeys = await this.getSettings();
        let found = null;
        allKeys.some(k => {
          if (k.key === key) {
            found = k;
            return true;
          }
        });
        return found;
      },
      async setSetting(value) {
        const key = value.key;
        const newObj = await this.upsert(value);
        const allKeys = await this.findAll();
        app.memcached.set(MEM_TOKEN, allKeys);
      },
    },
  });
};