'use strict';

'use strict';

const BaseGenerator = require('../../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);

  class Image extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'image';
    }

    formAPIQueryStr(service, tag, obj, rest) {
      return `${obj.endpoint}/${tag}s`;
    }

    async getProjectId(resource) {
      if (resource.owner_id) {
        return resource.owner_id;
      }
      return await super.getProjectId(resource);
    }

    async getProductAmount(body, opt) {
      return 1;
    }
    async filterResult(result, service, tag, obj, rest) {
      result.images = result.images.filter((image) => {
        return image.image_type === 'snapshot';
      });
      return result;
    }

  }
  return Image;
}