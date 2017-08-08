'use strict';

'use strict';

/**
 * This middleware check the API's auth:
 * 1. It is the admin.
 * 2. It is the user itself.
 */
module.exports = (options) => {
  return async(ctx, next) => {

    if (ctx.isAdmin) {
      await next();
    } else {
      const userId = ctx.params.userId;
      if (userId === ctx.user.id) {
        await next();
        return;
      }
      ctx.throw(404);
    }
  }
}