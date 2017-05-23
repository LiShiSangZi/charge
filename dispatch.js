'use strict';

const egg = require('egg');

const workers = Number(process.argv[2] || Math.min(4, require('os').cpus().length));

egg.startCluster({
  workers,
  baseDir: __dirname,
});