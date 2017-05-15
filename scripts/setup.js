'use strict';

/**
 * Use to configure the middleware for modules.
 */
const fs = require('fs');
const ini = require('ini');
const chalk = require('chalk');
const childProcess = require('child_process');
const spawn = childProcess.spawnSync;

/**
 * 
 * @param {Object} config 
 * @param {Boolean} true will fix the issue we found. 
 */
function checkModule(config, update) {
  // Step1: Check if the filter is installed:
  const res = spawn('file', ['/usr/lib/python2.7/site-packages/billingmiddleware/billing.py']);
  const output = res.output.toString();

  if (output.indexOf('No such file or directory') >= 0) {
    throw new Error('Fail to install billing middleware!');
  } else {
    console.log("Billing middleware installed!");
  }

  const module = config;
  const modules = module.modules;
  const key = module.key;
  const filterObj = module.filter;
  const filterKey = `filter:${key}`;

  const errors = [];

  modules.forEach(service => {
    const filter = JSON.parse(JSON.stringify(filterObj));
    const file = service.name;
    filter.billing_wsgi_url = filter.billing_wsgi_url.replace('${module}', file);
    let apiFileName = service.api || 'api-paste.ini';
    const fileName = `/etc/${file}/${apiFileName}`;
    let rawContent = fs.readFileSync(fileName, 'utf-8');

    let dirty = false;
    const keyField = service.keyField || 'keystone';

    const reg = new RegExp(`${keyField}\ *\=\ *(.*)`, 'g');

    const testReg = new RegExp(`\ ${config.key}(\ |$)`);

    const missingMiddleware = false;

    rawContent = rawContent.replace(reg, (matched, serviceList) => {

      if (testReg.test(serviceList)) {
        return matched;
      }
      if (!update) {
        missingMiddleware = true;
        return matched;
      }
      let maxPos = -1;
      let maxKey = null;
      module.keycontext.forEach(context => {
        const index = serviceList.indexOf(context);
        if (index > maxPos) {
          maxPos = index;
          maxKey = context;
        }
      });
      if (maxPos > -1) {
        dirty = true;
        serviceList = serviceList.replace(maxKey, `${maxKey} ${module.key}`);
      }

      return `${keyField} = ${serviceList}`;
    });

    if (missingMiddleware) {
      throw new Error(`${fileName} does not configure the middleware. Please update it first.`);
    }

    const filterReg = new RegExp(`\\[filter\\:${key}\\]`);
    if (!filterReg.test(rawContent)) {
      // Append the filter at the end:
      if (!update) {
        throw new Error(`${fileName} does not configure the middleware. Please update it first.`);
      }
      dirty = true;
      const filterKeys = Object.keys(filter);
      rawContent = [rawContent, `[filter:${key}]`]
        .concat(filterKeys.map(k => `${k} = ${filter[k]}`)).join('\n');
    }

    if (update && dirty) {
      // Backup the original file:
      spawn('cp', [fileName, `${fileName}.bak.${Date.now()}`]);
      fs.writeFileSync(fileName, rawContent);
      let content = chalk.bgGreen.black(`systemctl restart openstack-${file}-api`);
      if (service.service) {
        content = chalk.bgGreen.black(`systemctl restart ${service.service}`);
      }
      console.log(`Module ${file} updated. Please restart the service by 
${content}.`);
    }
  });


  if (errors.length > 0 && !update) {
    throw new Error(errors.join('\n'));
  }
}

if (module.parent) {
  module.exports = checkModule;
} else {
  const config = require('../config/config.default.js');
  const chargeModule = config.chargeModule;
  checkModule(chargeModule, true);
}