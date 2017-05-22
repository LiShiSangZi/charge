'use strict';

const BaseGenerator = require('../../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);

  class FloatingIP extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'floatingip';
    }
    async getResourceById(uuid, opt) {
      const resultObj = await this.getSingleResourceById(uuid, opt);
      return {
        "resource_id": resultObj.id,
        "resource_name": resultObj.name,
      };
    }

    getResourceAttribute(req, res, tag) {
      if (res) {
        if (res.floatingip) {
          return {
            "resource_id": res.floatingip.id,
            "resource_name": res.floatingip['floating_ip_address'],
          };
        } else if (res.floating_ip) {
          return {
            "resource_id": res.floating_ip.id,
            "resource_name": res.floating_ip.ip,
          };
        }
      }
      return null;
    }

  }
  return FloatingIP;
}