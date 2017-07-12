'use strict';

const checkModule = require('./scripts/setup');

module.exports = async(app) => {
  if (app.config.ignoreMiddlewareChecker !== true) {
    checkModule(app.config.chargeModule);
  }
  app.messenger.once('init-job', data => {
    
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


        const tokenObj = await ctx.service.token.getToken();
        const endpoint = tokenObj.endpoint['keystone']['RegionOne'];

        const targetRole = await ctx.curl(`${endpoint}/roles?name=${app.config.charge.billing_role}`, {
          method: 'GET',
          dataType: 'json',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': tokenObj.token,
          },
        });

        if (targetRole.data && targetRole.data.roles.length > 0) {
          const roleId = targetRole.data.roles[0].id;

          const roles = await ctx.service.keystone.fetchAssignments('RegionOne');

          const roleAssignmentDict = new Map();

          roles.role_assignments.forEach(r => {
            if (r.role && r.role.id === roleId) {
              const p = r.scope.project;
              roleAssignmentDict.set(p.id, r.user.id);
            }
          });
          const projects = await ctx.service.keystone.fetchProjects('RegionOne');
          projects.projects.forEach(project => {
            promises[index++] = app.model.Project.findOrCreate({
              where: {
                "project_id": project.id
              },
              defaults: {
                "user_id": roleAssignmentDict.get(project.id) || null,
                "project_id": project.id,
                "domain_id": project.domain_id,
                "status": "active",
              }
            })
          });

          await Promise.all(promises);
        }
      }
    })().then(res => {});
  });

  app.beforeStart(function* () {
    app.model.sync();
    app.model.Subscription.sync();
  });
}