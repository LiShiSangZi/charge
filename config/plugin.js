'use strict';

const path = require('path');

exports.security = {
  enable: false
};

exports.sequelize = {
  enable: true,
  package: 'egg-sequelize'
};

exports.memcached = {
  enable: true,
  path: path.join(__dirname, '../lib/plugin/memcached'),
};
