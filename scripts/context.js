'use strict';

const request = require('superagent');
const glob = require('glob');
const path = require('path');

const config = require('../config/config.default');

/**
 * Mock the ctx and app.
 */
class ServiceBase extends Object {
  constructor(ctx) {
    super();
    this.ctx = ctx;
  }
}

const root = path.join(__dirname, '..', 'app/service');

const serviceList = glob.sync('**/*.js', {
  cwd: root
});

class Context {
  constructor(app) {
    this.app = app;
    this.service = {};
    serviceList.forEach(service => {
      const url = path.join(root, service);
      const Service = require(url);
      const ServiceClass = Service(app);

      const p = service.split('/');

      let startObject = this.service;
      for (let i = 0; i < p.length; i++) {
        const key = p[i];
        if (i < p.length - 1) {
          if (!startObject[key]) {
            startObject[key] = {};
          }
        } else {
          
          startObject[key.replace(/\.js$/, '')] = new ServiceClass(this);
        }
        startObject = startObject[key];
      }

    });
  }
  curl(url, opt) {
    
    const method = (opt.method || 'GET').toLowerCase();
    const req = request[method](url);
    const header = {};
    if (opt.dataType === 'json') {
      req.set('Accept', 'application/json');
    }
    if (opt.headers) {
      Object.keys(opt.headers).forEach(key => {
        req.set(key, opt.headers[key]);
      });
    }

    if (opt.data) {
      req.send(opt.data);
    }

    return new Promise((resolve, reject) => {
      req.end((err, res) => {
        if (err) {
          // console.log(err, url);
          reject(err);
        } else {
          resolve({
            data: res.body,
            headers: res.headers
          });
        }
      });
    });
  }
}

const app = {
  Service: ServiceBase,
  config: config,
  addSingleton: function(type, func) {
    this[type] = func(config[type].client.nodes, this);
  },
  mockContext: function () {
    // Load all the service.
    return new Context(this);
  }
};

const pluginPath = path.join(__dirname, '..', 'lib/plugin');
// Load the plugin config:
const pluginApp = glob.sync('*', {
  cwd: pluginPath,
});

pluginApp.forEach(appFile => {
  const appPath = path.join(pluginPath, appFile, 'app.js');
  const application = require(appPath)(app);
});


module.exports = app.mockContext();