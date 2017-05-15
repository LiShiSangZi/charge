'use strict';

const ClientUtils = require('../../app');

exports.saveToCache = (key, value) => {
  const client = ClientUtils.getMemCachedClient();
  if (!client) {
    throw new Error('Failed to initialize the client.');
  }
  return client.set(key, value);
}

exports.loadFromCache = (key) => {
  const client = ClientUtils.getMemCachedClient();
  if (!client) {
    throw new Error('Failed to initialize the client.');
  }
  return client.get(key);
}

exports.destroyCache = (key) => {
  const client = ClientUtils.getMemCachedClient();
  if (!client) {
    throw new Error('Failed to initialize the client.');
  }
  return client.del(key);
}