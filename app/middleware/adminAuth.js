'use strict';

/**
 * This middleware is for the admin auth.
 */
module.exports = (options) => {
  return async(ctx, next) => {
    if (ctx.isAdmin) {
      await next();
    } else {
      ctx.throw(409, 'The operation requires admin roles!');
    }
  }
}