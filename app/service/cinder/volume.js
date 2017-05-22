'use strict';

const BaseGenerator = require('../../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);

  class Volume extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'volume';
    }
    async getProductAmount(body, opt) {
      if (body.restore && body.restoreId) {
        const o = await this.getTokenAndEndpoint(opt);
        const res = await this.ctx.curl(`${o.endpoint}/backups/${body.restoreId}`, {
          method: 'GET',
          dataType: 'json',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': o.token,
          },
          timeout: 5000,
        });
        if (res.data && res.data.backup) {
          return res.data.backup.size || 0;
        }
        return 0;
      }
      if (body.volume) {
        return body.volume.size || 1;
      }
      if (body['os-extend']) {
        return body['os-extend']['new_size'] || 1;
      }
      return 1;
    }

    getResourceAttribute(req, res, tag) {
      if (res.restore) {
        return {
          "resource_id": res.restore.volume_id,
          "resource_name": res.restore.volume_name,
        };
      }
      return super.getResourceAttribute(req, res, tag);
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
          o.uuid = this.parsePutUUID(opt);
          return await super.PUT(opt);
        }
      } else if (/\/volumes$/.test(opt.requestUrl)) {
        return await super.POST(opt);
      } else if (/restore$/.test(opt.requestUrl)) {
        const res = /backups\/(.*)\/restore$/.exec(opt.requestUrl);
        if (res && res.length > 1 && opt.request.restore.volume_id === undefined) {
          opt.request.restoreId = res[1];
          return await super.POST(opt);
        }
      }
    }
    async getProjectId(resource) {
      return resource['os-vol-tenant-attr:tenant_id'];
    }

    async getProductName(service, tag, body, catalogs, region) {
      if (body.restore && body.restore.type) {
        return `cinder:volume:${body.restore.type}`;
      } else if (body.volume && body.volume.volume_type) {
        const volumeType = body.volume.volume_type;
        return `cinder:volume:${volumeType}`;
      } else if (body.uuid) {
        const resource = await this.getSingleResourceById(body.uuid, {
          tag: 'volume',
          region: region,
          module: service,
        });
        let volumeType = `:${resource.volume_type}` || '';
        return `cinder:volume${volumeType}`;
      }
    }

    formAPIQueryStr(service, tag, obj, rest) {
      return `${obj.endpoint}/${tag}s/detail?all_tenants=1`;
    }

    async filterResult(result, service, tag, obj, rest) {
      if (rest && rest.length > 0) {
        return result.filter(v => v.volume_type === res[0]);
      } else {
        return result;
      }
    }
  }
  return Volume;
}