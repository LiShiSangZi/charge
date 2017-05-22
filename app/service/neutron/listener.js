'use strict';

const BaseGenerator = require('../../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);

  class Listener extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'listener';
    }
    formAPIQueryStr(service, tag, obj, rest) {
      console.log(`${obj.endpoint}/lbaas/${tag}s`);
      return `${obj.endpoint}/lbaas/${tag}s`;
    }
    
  }
  return Listener;
}
