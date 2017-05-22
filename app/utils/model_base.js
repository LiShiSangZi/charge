'use strict';

const writeData = (instance, created) => {
  if (instance instanceof Array) {
    instance.forEach(writeData);
  } else {
    const now = Math.round(Date.now() / 1000) * 1000;
    if (!instance.created_at) {
      if (created) {
        instance.created_at = now;
      }
    } else if (instance.created_at instanceof Date) {
      instance.created_at = instance.created_at.getTime();
    }
    if (!instance.updated_at) {
      instance.updated_at = now;
    } else if (instance.updated_at instanceof Date) {
      instance.updated_at = instance.updated_at.getTime();
    }
  }
};

const readData = (instance) => {
  if (instance instanceof Array) {
    instance.forEach(readData);
  } else {
    if (instance.created_at) {
      instance.created_at = new Date(instance.created_at);
    }
    if (instance.updated_at) {
      instance.updated_at = new Date(instance.updated_at);
    }
  }
}

/**
 * Handle bug that sequlize have timestamp issue.
 */
module.exports = {
  beforeBulkCreate: (instance, options) => {
    writeData(instance, true);
  },
  beforeBulkUpdate: (options) => {
    // TODO: Add me.
  },
  beforeCreate: (instance) => {
    writeData(instance, true);
  },
  beforeUpdate: (instance) => {
    writeData(instance);
  },
  beforeSave: (instance) => {
    writeData(instance);
  },
  beforeUpsert: (values) => {
    // TODO: Add me.
  },
}
