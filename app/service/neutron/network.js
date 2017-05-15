'use strict';

const BaseGenerator = require('../../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);

  class Network extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'network';
    }


    formAPIQueryStr(service, tag, obj) {
      return `${obj.endpoint}/v2.0/${tag}s`;
    }
    
  }
  return Network;
}
