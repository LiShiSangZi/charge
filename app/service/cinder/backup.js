'use strict';

const BaseGenerator = require('../../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);

  class Backup extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'backup';
    }

    // async getRelatedVolume(volumeId, opt) {
    //   const o = await this.getTokenAndEndpoint(opt);
    //   const res = await this.ctx.curl(`${o.endpoint}/volumes/${volumeId}`, {
    //     method: 'GET',
    //     dataType: 'json',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'X-Auth-Token': o.token,
    //     },
    //   });
    //   if (res.data && res.data.volume && res.data.volume.size) {
    //     return res.data.volume;
    //   }
    // }

    // async getProjectId(resource) {
    //   let projectId = null;
    //   if (resource && resource.links) {
    //     const reg = /\/([0-9,a-f,A-F]+)\/backups/;
    //     resource.links.some(link => {
    //       if (link.rel == 'self') {
    //         const res = reg.exec(link.href);
    //         if (res && res.length >1) {
    //           projectId = res[1];
    //         }
    //         return true;
    //       }
    //     });
    //   }

    //   if (projectId) {
    //     return projectId;
    //   }

    //   return await super.getProjectId(resource);
    // }

    // async getProductAmount(body, opt) {
    //   if (body.backup) {
    //     const volumeId = body.backup.volume_id;
    //     if (volumeId) {
    //       const volume = await this.getRelatedVolume(volumeId, opt);
    //       if (volume) {
    //         return volume.size;
    //       }
    //     }
    //   }
    //   if (opt.response && opt.response.backup) {
    //     return opt.response.backup.size || 1;
    //   }
    //   return 1;
    // }

    // /**
    //  * Get the endpoint's name according by the option.
    //  * @param {*Option} opt 
    //  */
    // getModuleName(opt) {
    //   return 'cinderv2';
    // }

    // formAPIQueryStr(service, tag, obj, rest) {
    //   return `${obj.endpoint}/${tag}s/detail?all_tenants=1`;
    // }

    // async getProductName(service, tag, body, catalogs, region) {
    //   if (body.backup) {
    //     const volumeId = body.backup.volume_id;
    //     if (volumeId) {
    //       const volume = await this.getRelatedVolume(volumeId, {
    //         "region": region,
    //         "module": "cinder",
    //       });
    //       if (volume) {
    //         return `cinder:backup:${volume.volume_type}`;
    //       }
    //     }
    //   }
    //   return `cinder:backup`;
    // }
  }
  return Backup;
}