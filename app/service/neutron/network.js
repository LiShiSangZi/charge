'use strict';

const BaseGenerator = require('../../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);

  class Network extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'network';
    }
    
  }
  return Network;
}
