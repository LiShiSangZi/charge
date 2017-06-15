'use strict';

const BaseGenerator = require('../../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);

  class Snapshot extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'snapshot';
    }
    /**
     * Overrided
     * 
     */
    async generateMetaData(order, body, attr, catalogs, region) {
      if (body.snapshot) {
        const volumeId = body.snapshot.volume_id;
        if (volumeId) {
          const o = await this.getTokenAndEndpoint({
            module: 'cinder',
            region: region,
          });
          const res = await this.ctx.curl(`${o.endpoint}/volumes/${volumeId}`, {
            method: 'GET',
            dataType: 'json',
            headers: {
              'Content-Type': 'application/json',
              'X-Auth-Token': o.token,
            },
          });
          if (res.data && res.data.volume && res.data.volume.size) {
            return [{
              order_id: order.order_id,
              resource_id: order.resource_id,
              name: 'size',
              value: res.data.volume.size,
              type: 'number',
            }, {
              order_id: order.order_id,
              resource_id: order.resource_id,
              name: 'sourceName',
              value: res.data.volume.name,
              type: 'string',
            }, {
              order_id: order.order_id,
              resource_id: order.resource_id,
              name: 'sourceId',
              value: volumeId,
              type: 'string',
            }];
          }
        }
      }
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
            return res.data.volume.size;
          }
        }
      }
      if (opt.response && opt.response.snapshot) {
        return opt.response.snapshot.size || 1;
      }
      return 1;
    }

    async getProjectId(resource) {
      return resource['os-extended-snapshot-attributes:project_id'];
    }

    formAPIQueryStr(service, tag, obj, rest) {
      return `${obj.endpoint}/${tag}s/detail?all_tenants=1`;
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