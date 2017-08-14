'use strict';

const chalk = require('chalk');
const mock = require('egg-mock');
const uuidV4 = require('uuid/v4');
const name = process.argv[2];
if (!name) {
  console.log(chalk.red(`Fail to execute the schedule job as parameter name is not defined. Please run "npm run schedule YOUR_SCHEDULE_JOB_NAME.`));
} else {
  console.log(chalk.green(`Prepare to execute the schedule job ${name}`));
}

const exec = async() => {

  const app = mock.app();

  await app.ready();
  await app.model.sync();
  const ctx = app.mockContext();

  try {
    await app.runSchedule(name);
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.log(chalk.red(`The schedule job ${name} does not exist.`));
    }
  }

};

const run = exec().then(r => {
  console.log('done.');
  process.exit(0);
}).catch(f => {
  console.error(f);
  process.exit(1);
});