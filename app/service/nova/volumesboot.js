'use strict';

const BaseGenerator = require('../../utils/service_base.js');
module.exports = app => {
  const Base = BaseGenerator(app);

  class Server extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'server';
    }
    async PUT(opt) {
      return;
    }
    async DELETE(opt) {
      return;
    }
    async POST(opt) {
      return await super.POST(opt);
    }
    async getProductName(service, tag, body, catalogs, region) {
      if (body && body.server && body.server.flavorRef) {
        return `${service}:server:${body.server.flavorRef}`;
      }
    }

    getType(opt) {
      return 'server';
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

    async getProductAmount(body) {
      if (body && body.server && body.server.max_count > 0 &&
        body.server.max_count === body.server.min_count) {
        return body.server.min_count;
      }
      return 1;
    }

    async getSingleResourceById(uuid, opt) {
      const o = await this.getTokenAndEndpoint(opt);
      const res = await this.ctx.curl(`${o.endpoint}/servers/${uuid}`, {
        method: 'GET',
        dataType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': o.token,
        },
        timeout: 5000,
      });
      const resultObj = res.data['server'];
      return resultObj;
    }

    getResourceAttribute(req, res, tag) {

      if (res) {
        const o = {
          "resource_id": res.server.id,
          "resource_name": req.server.name,
        };
        return o;
      }
      return null;
    }
  }
  return Server;
}