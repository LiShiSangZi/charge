'use strict';

const writeData = (ins, created) => {
  const travelInstance = (instance) => {
    const now = Math.round(Date.now() / 1000) * 1000;
    if (!instance.created_at) {
      if (created) {
        instance.created_at = now;
      }
    } else if (instance.created_at instanceof Date) {
      instance.created_at = instance.created_at.getTime();
    }
    if (!instance.updated_at ||
      (instance._changed && instance._changed.updated_at === undefined)) {
      instance.updated_at = now;
    } else if (instance.updated_at instanceof Date) {
      instance.updated_at = instance.updated_at.getTime();
    }
  }
  if (ins instanceof Array) {
    ins.forEach(travelInstance);
  } else {
    travelInstance(ins);
  }
};

const readData = (instance) => {
  if (instance instanceof Array) {
    instance.forEach(readData);
  } else if (instance) {
    if (instance.created_at) {
      instance.created_at = new Date(instance.created_at);
    }
    if (instance.updated_at) {
      instance.updated_at = new Date(instance.updated_at);
    }
    if (instance._changed) {
      delete instance._changed.created_at;
      delete instance._changed.updated_at;
    }
  }
}

/**
 * Handle bug that sequlize have timestamp issue.
 */

class HookBase {
  beforeBulkCreate(instance) {
    writeData(instance, true);
  }
  beforeBulkUpdate(options) {
    // TODO: Add me here.
  }
  beforeCreate(instance) {
    writeData(instance, true);
  }
  beforeUpdate(instance) {
    writeData(instance);
  }
  beforeSave(instance) {
    writeData(instance);
  }
  beforeUpsert(values) {
    // TODO: Add me.
  }
  afterFind(instance) {
    readData(instance);
  }
  toJSON() {
    const fields = ['beforeBulkCreate', 'beforeBulkUpdate', 'beforeCreate',
      'beforeUpdate', 'beforeSave', 'beforeUpsert', 'afterFind'
    ];

    const result = {};
    fields.forEach(key => {
      result[key] = this.__proto__[key];
    });
    return result;
  }
}

module.exports = HookBase;
