'use strict';

const BaseGenerator = require('../../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);

  class Server extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'server';
    }
    async getProductAmount(body) {
      return 1; //body.server.min_count;
    }
    /**
     * Overrided
     * 
     */
    async generateMetaData(order, body, attr, catalogs, region) {
      let flavorRef = null;
      if (body.server) {
        flavorRef = body.server.flavorRef;
      } else if (body.resize) {
        flavorRef = body.resize.flavorRef;
      }
      if (flavorRef) {
        const o = await this.getTokenAndEndpoint({
          module: 'nova',
          region: region,
        });
        const res = await this.ctx.curl(`${o.endpoint}/flavors/${flavorRef}`, {
          method: 'GET',
          dataType: 'json',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': o.token,
          },
        });
        const flavor = res.data.flavor;
        return [{
          "order_id": order.order_id,
          "resource_id": order.resource_id,
          "name": "ram",
          "value": flavor.ram,
          "type": typeof flavor.ram,
        }, {
          "order_id": order.order_id,
          "resource_id": order.resource_id,
          "name": "vcpus",
          "value": flavor.vcpus,
          "type": typeof flavor.vcpus,
        }, {
          "order_id": order.order_id,
          "resource_id": order.resource_id,
          "name": "disk",
          "value": flavor.disk,
          "type": typeof flavor.vcpus,
        }];
      }
    }
    /**
     * The server's product name is generated according to the flavor ID.
     * 
     * @param {*Request} body 
     * @param {*Catalog} catalogs 
     * @param {*String} region 
     */
    async getProductName(service, tag, body, catalogs, region) {
      if (body.server) {
        const flavorRef = body.server.flavorRef;
        return `nova:server:${flavorRef}`;
      } else if (body.resize) {
        const flavorRef = body.resize.flavorRef;
        return `nova:server:${flavorRef}`;
      }
    }

    getProjectId(resource) {
      return resource['tenant_id'];
    }

    formAPIQueryStr(service, tag, obj, rest) {
      return `${obj.endpoint}/${tag}s/detail?all_tenants=1&flavor=${rest[0]}`;
    }

    /**
     * Parse the uuid out from an option.
     * @param {*Options} opt 
     */
    parsePutUUID(opt) {
      if (/\/action/.test(opt.requestUrl)) {
        return opt.requestUrl.replace(/\/$/, '').replace(/^(.*)\/servers\//, '').replace(/\/action(.*)$/, '');
      }
      return super.parsePutUUID(opt);
    }

    async POST(opt) {
      if (opt.request.resize) {
        return await this.PUT(opt);
      }
      return await super.POST(opt);
    }

    async DELETE(opt) {

      const req = opt.requestUrl.replace(/^(.*?)servers\/[0-9,a-z,-]+/, '').replace(/^\//, '');
      const reqData = req.split('/');

      if (reqData.length > 1) {
        return;
      }

      return await super.DELETE(opt);
    }
  }
  return Server;
}