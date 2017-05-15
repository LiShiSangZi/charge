'use strict';

const BaseGenerator = require('../../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);

  class Snapshot extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'snapshot';
    }

    async getProductAmount(body, opt) {

      if (body.snapshot) {
        const volumeId = body.snapshot.volume_id;
        if (volumeId) {
          const o = await this.getTokenAndEndpoint(opt);
          const res = await this.ctx.curl(`${o.endpoint}/volumes/${volumeId}`, {
            method: 'GET',
            dataType: 'json',
            headers: {
              'Content-Type': 'application/json',
              'X-Auth-Token': o.token,
            },
          });
          if (res.data && res.data.volume && res.data.volume.size) {
            return volume.size;
          }
        }
      }
      return 1;
    }

    /**
     * Get the endpoint's name according by the option.
     * @param {*Option} opt 
     */
    getModuleName(opt) {
      return 'cinderv2';
    }
  }
  return Snapshot;
}
