'use strict';

const BaseGenerator = require('../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);


  class Server extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'server';
    }

    filterURLs(url) {
      const left = url.replace(/^(.*?)\:(\d+)(\/v\d)*/, '').replace(/^\//, '').replace(/\?(.*)$/, '');
      return left.split('/');
    }

    async fetchProjectById(projectId, region) {
      const tokenObj = await this.ctx.service.token.getToken();
      const endpoint = tokenObj.endpoint['keystone'][region || 'RegionOne'];

      const res = await this.ctx.curl(`${endpoint}/projects/${projectId}`, {
        method: 'GET',
        dataType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': tokenObj.token,
        },
      });

      return res.data;
    }

    /**
     * Get role object by ID.
     * @param {*String} roleId 
     */
    async getRole(roleId, region) {
      const tokenObj = await this.ctx.service.token.getToken();
      const endpoint = tokenObj.endpoint['keystone'][region || 'RegionOne'];
      const res = await this.ctx.curl(`${endpoint}/roles/${roleId}`, {
        method: 'GET',
        dataType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': tokenObj.token,
        },
      });

      return res.data.role;
    }

    async GET(opt) {
    }

    async DELETE(opt) {
      if (opt.phase === 'after') {
        const url = opt.requestUrl;
        const params = this.filterURLs(url);
        const type = params[0];
        if (type === 'projects' && params.length === 6) {
          const projectId = params[1];
          const userId = params[3];
          const roleId = params[5];

          // Get user role detail for the roleId:
          const role = await this.getRole(roleId, opt.region);
          if (role.name === this.ctx.app.config.charge['billing_role']) {
            // Connect the project with account.
            this.ctx.app.model.Project.update({
              user_id: null,
            }, {
              where: {
                project_id: projectId,
              },
            });
          }

        }
      }
    }

    async PUT(opt) {
      if (opt.phase === 'after') {
        const url = opt.requestUrl;
        const params = this.filterURLs(url);
        const type = params[0];
        if (type === 'projects' && params.length === 6) {
          const projectId = params[1];
          const userId = params[3];
          const roleId = params[5];

          // Get user role detail for the roleId:
          const role = await this.getRole(roleId, opt.region);
          if (role.name === this.ctx.app.config.charge['billing_role']) {
            // Connect the project with account.
            const res = await this.ctx.app.model.Project.update({
              user_id: userId,
            }, {
              where: {
                project_id: projectId,
              },
            });

            if (res.length === 1 && res[0] === 0) {
              const r = await this.fetchProjectById(projectId, opt.region);
              if (r.project) {
                const domainId = r.project.domain_id;
                const newProject = await this.ctx.app.model.Project.create({
                  user_id: userId,
                  project_id: projectId,
                  domain_id: domainId,
                });
              }
            }
          }

        }
      }
    }

    async POST(opt) {
      if (opt.phase === 'after') {
        const url = opt.requestUrl;
        const params = this.filterURLs(url);
        const type = params[0];
        switch (type) {
          case 'users':
            // This should be a create user API:
            const newAccount = await this.ctx.app.model.Account.findOrCreate({
              where: {
                user_id: opt.response.user.id,
              },
              defaults: {
                user_id: opt.response.user.id,
                domain_id: opt.response.user.domain_id
              }
            });
            break;
          case 'projects':
            if (params.length > 1) {

            } else {
              const newProject = await this.ctx.app.model.Project.findOrCreate({
                where: {
                  project_id: opt.response.project.id,
                },
                defaults: {
                  project_id: opt.response.project.id,
                  domain_id: opt.response.project.domain_id,
                },
              });
            }
            break;
        }
      }
    }

    async fetchUsers(region) {
      const tokenObj = await this.ctx.service.token.getToken();
      const endpoint = tokenObj.endpoint['keystone'][region || 'RegionOne'];
      const res = await this.ctx.curl(`${endpoint}/users`, {
        method: 'GET',
        dataType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': tokenObj.token,
        },
      });
      return res.data;
    }

    async fetchAssignments(region) {
      const tokenObj = await this.ctx.service.token.getToken();
      const endpoint = tokenObj.endpoint['keystone'][region || 'RegionOne'];
      const res = await this.ctx.curl(`${endpoint}/role_assignments`, {
        method: 'GET',
        dataType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': tokenObj.token,
        },
      });
      return res.data;
    }

    async fetchProjects(region) {
      const tokenObj = await this.ctx.service.token.getToken();
      const endpoint = tokenObj.endpoint['keystone'][region || 'RegionOne'];
      const res = await this.ctx.curl(`${endpoint}/projects`, {
        method: 'GET',
        dataType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': tokenObj.token,
        },
      });
      return res.data;
    }
  }
  return Server;
}