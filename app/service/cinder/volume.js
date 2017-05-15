'use strict';

const BaseGenerator = require('../../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);

  class Volume extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'volume';
    }
    async getProductAmount(body) {
      if (body.volume) {
        return body.volume.size || 1;
      }
      if (body['os-extend']) {
        return body['os-extend']['new_size'] || 1;
      }
      return 1;
    }

    /**
     * Get the endpoint's name according by the option.
     * @param {*Option} opt 
     */
    getModuleName(opt) {
      if (opt.module === 'cinder') {
        return 'cinderv2';
      }
      return opt.module;
    }

    parsePutUUID(opt) {
      const url = opt.requestUrl;
      const res = /volumes\/(.*?)\/action/.exec(url);
      if (res.length > 1) {
        return res[1];
      }
      return url;
    }

    async POST(opt) {
      if (/\/action$/.test(opt.requestUrl)) {
        const o = opt.request;
        if (o['os-extend'] && o['os-extend'].new_size) {
          return await super.PUT(opt);
        }
      } else if (/\/volumes$/.test(opt.requestUrl)) {
        return await super.POST(opt);
      }
    }
    async getProjectId(resource) {
      return resource['os-vol-tenant-attr:tenant_id'];
    }

    formAPIQueryStr(service, tag, obj) {
      return `${obj.endpoint}/${tag}s/detail?all_tenants=1`;
    }
  }
  return Volume;
}