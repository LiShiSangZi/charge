'use strict';

/**
 * Common price service.
 */
'use strict';

const BaseGenerator = require('../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);


  class Common extends Base {
    constructor(ctx) {
      super(ctx);
    }
  }
  return Common;
}
