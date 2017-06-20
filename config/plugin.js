'use strict';

const path = require('path');

exports.security = {
  enable: false
};

exports.sequelize = {
  enable: true,
  package: 'egg-sequelize'
};

exports.keystone = {
  enable: true,
  package: 'egg-keystone'
};

exports.memcached = {
  enable: true,
  package: 'egg-memcached'
};
