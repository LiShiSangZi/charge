'use strict';

/**
 * Fetch the us1erId according to the token. If the token is not spec, will throw 401.
 */
const debug = require('debug')('charge.access');

module.exports = options => {
  return async(ctx, next) => {
    let before;
    if (options.enabled) {
      before = Date.now();
    }
    await next();
    if (options.enabled) {
      debug(`${ctx.path}: ${Date.now() - before}`);
    }
  }
};