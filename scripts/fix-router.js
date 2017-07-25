'use strict';

/**
 * This is used to fix the data issue of router.
 * It will close all router order and create new one.
 */

const mock = require('egg-mock');
const exec = async() => {

  const app = mock.app();

  await app.ready();
  await app.model.sync();
  const ctx = app.mockContext();

  // Step1: Close all the router's order.

  // Step2: Create new order according to the user's resource.
};

const run = exec().then(r => {
  console.log(r);
  process.exit(0);
}).catch(f => {
  process.exit(1);
});