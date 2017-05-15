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
     * The server's product name is generated according to the flavor ID.
     * 
     * @param {*Request} body 
     * @param {*Catalog} catalogs 
     * @param {*String} region 
     */
    async getProductName(service, tag, body, catalogs, region) {
      const flavorRef = body.server.flavorRef;
      return `nova:server:${flavorRef}`;
    }
    getProjectId(resource) {
      return resource['tenant_id'];
    }

    formAPIQueryStr(service, tag, obj, rest) {
      return `${obj.endpoint}/${tag}s/detail?all_tenants=1&flavor=${rest[0]}`;
    }
  }
  return Server;
}
