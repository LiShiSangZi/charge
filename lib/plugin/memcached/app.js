'use strict';

const Memcached = require('memcached');

class Client {
  constructor(mem) {
    this.mem = mem;
  }

  get(key) {
    return new Promise((resolve, reject) => {
      this.mem.get(key, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  getMulti(keys) {
    return new Promise((resolve, reject) => {
      this.mem.getMulti(keys, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  set(key, value, lifetime) {
    if (typeof lifetime === 'undefined') {
      lifetime = 3600 * 24;
    }

    return new Promise((resolve, reject) => {
      this.mem.set(key, value, lifetime, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  del(key) {
    return new Promise((resolve, reject) => {
      this.mem.del(keys, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

let client = null;

function createClient(config, app) {
  if (client) {
    return client;
  }
  const memClient = new Memcached(config.hosts);
  client = new Client(memClient);
  return client;
}

module.exports = app => {
  app.addSingleton('memcached', createClient);
};

module.exports.getMemCachedClient = () => {
  return client;
}