'use strict';

const chalk = require('chalk');
const mock = require('egg-mock');
const uuidV4 = require('uuid/v4');

const region = process.argv[2];
if (region) {
  console.log('update router orders in "' + region + '".');
} else {
  console.log(chalk.red('Failed to excute script since argument region is null!' +
    '\nyou can do like "npm run fix-router RegionOne"'));
  process.exit(1);
}

const exec = async() => {

  const app = mock.app();

  await app.ready();
  await app.model.sync();
  const ctx = app.mockContext();


  await app.runSchedule('checker');

};

const run = exec().then(r => {
  console.log('done.');
  process.exit(0);
}).catch(f => {
  console.error(f);
  process.exit(1);
});