'use strict';

const checkModule = require('./scripts/setup');

module.exports = async(app) => {

  checkModule(app.config.chargeModule);

  app.beforeStart(function* () {
    app.model.sync();
    (async() => {
      // Mock a context:
      const ctx = app.createAnonymousContext();
      await ctx.service.token.initEndpoint();

      if (app.config.requireMerge) {
        const users = await ctx.service.keystone.fetchUsers('RegionOne');
        const promises = [];
        let index = 0;

        users.users.forEach(user => {
          promises[index++] = app.model.Account.findOrCreate({
            where: {
              "user_id": user.id
            },
            defaults: {
              "user_id": user.id,
              "domain_id": user.domain_id,
            }
          });
        });

        await Promise.all(promises);

      }
    })().then(res => {});
  });
}
