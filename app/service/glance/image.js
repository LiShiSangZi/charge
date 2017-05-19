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
    
  }
  return Image;
}
