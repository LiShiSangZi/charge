'use strict';

const egg = require('egg');
const config = require('./config/config.default.js');

const workers = Math.min(4, require('os').cpus().length);

egg.startCluster({
  workers,
  baseDir: __dirname,
  port: config.port,
});