'use strict';

/**
 * Fetch the userId according to the token. If the token is not spec, will throw 401.
 */

module.exports = options => {
  const reg = new RegExp(options.ignoreLink.map(m => `^\/${m}`).join('|'));
  return async(ctx, next) => {
    const req = ctx.request;
    if (!reg.test(req.url)) {
      // Check the auth here:
      const opt = {
        "module": "keystone",
        "region": req.header.region || 'RegionOne',
      }

      const header = req.headers;
      const o = await ctx.service.common.getTokenAndEndpoint(opt);
      const res = await ctx.curl(`${o.endpoint}/auth/tokens`, {
        method: 'GET',
        dataType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': o.token,
          'X-Subject-Token': header['x-auth-token'],
        },
      });
      if (res.data && res.data.token) {
        ctx.user = res.data.token.user;
        ctx.roles = res.data.token.roles;
        let isAdmin = false;
        res.data.token.roles.some(role => {
          if (role.name === 'admin') {
            isAdmin = true;
          }
          return isAdmin;
        });
        ctx.isAdmin = isAdmin;
      } else {
        ctx.throw(401);
        return;
      }
    }
    await next();
  };
}