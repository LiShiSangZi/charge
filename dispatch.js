'use strict';

const fs = require('fs');
const path = require('path');

const egg = require('egg');
const configBase = require('./config/config.default.js');
let env;
let config;
try {
  env = fs.readFileSync(path.join(__dirname, 'config', 'env'));
  env = env.toString().trim();
  let envConfig = require(`./config/config.${env}.js`);
  config = Object.assign(configBase, envConfig);
} catch (e) {
  config = configBase;
}

const workers = Math.min(1, require('os').cpus().length);

egg.startCluster({
  workers,
  baseDir: __dirname,
  port: config.port,
});


setTimeout(() => {
  const cluster = require('cluster');
  const works = cluster.workers;
  // const keys = Object.keys(workers);
  const work = works['1'];
  const newWorker = cluster.fork();
  newWorker.on('listening', () => {
    work.on('disconnect', () => {
      work.kill('SIGINT');
      work.process.kill('SIGINT');
    });
    work.disconnect();
  });
}, 1000);