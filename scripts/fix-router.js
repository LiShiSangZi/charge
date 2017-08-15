'use strict';

const chalk = require('chalk');
const mock = require('egg-mock');
const uuidV4 = require('uuid/v4');

const exec = async() => {

  const app = mock.app();

  await app.ready();
  await app.model.sync();
  const ctx = app.mockContext();

  try {
    // Send to server and wait for the response.
    const curl = async() => {
      const promise = ctx.curl(`http://10.0.101.53:8001/v1/test`, {
        method: 'GET',
      });

      promise.then((res) => {
        console.log(res.data.toString());
      });
      promise.catch(res => {
        console.log(res.errors);
      });

      await new Promise((resolve, reject) => {
        setTimeout(() => resolve(), 100);
      });

      await curl();
    };

    await curl();

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