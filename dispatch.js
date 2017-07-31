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

const workers = Math.min(4, require('os').cpus().length);

egg.startCluster({
  workers,
  baseDir: __dirname,
  port: config.port,
});

const cluster = require('cluster');
const disconnectingMap = new Map();

fs.watchFile(path.join(__dirname, 'package.json'), (evt, filename) => {
  const server = cluster.fork();
  server.once('listening', () => {
    const p = [];

    for (let id in cluster.workers) {
      if (id === server.id.toString()) {
        continue;
      }
      const promise = new Promise((resolve, reject) => {

        const w = cluster.workers[id];
        w.on('disconnect', () => {
          console.log(`Process ${w.process.pid} disconnected. Killing...`);
          w.kill('SIGTERM');
          setTimeout(() => {
            w.process.kill('SIGTERM');
            resolve();
          }, 100);
          console.log(`Process ${w.process.pid} kill action committed!`);
          disconnectingMap.delete(id);
        });
        console.log(`Disconnecting process ${w.process.pid}...`);

        w.exitedAfterDisconnect = true;

        w.disconnect();
        disconnectingMap.set(id, w);
      });
      p.push(promise);
    }
    Promise.all(p).then((...args) => {
      console.log(args);
      for (let i = 1; i < workers; i++) {
        cluster.fork();
      }
    });
  });
});

process.on('exit', () => {
  // Loop any disconnecting worker and kill them directly.
  const workers = cluster.workers;
  disconnectingMap.forEach((w, k) => {
    console.log(k);
    try {
      w.kill('SIGTERM');
      setTimeout(() => {
        w.process.kill('SIGTERM');
        resolve();
      }, 100);
    } catch (e) {
      console.log(e);
    }
  });
});