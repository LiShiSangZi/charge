'use strict';

const BaseGenerator = require('../../utils/service_base.js');
module.exports = app => {

  const Base = BaseGenerator(app);

  class Router extends Base {
    constructor(ctx) {
      super(ctx);
      this.tag = 'router';
    }
    formAPIQueryStr(service, tag, obj, rest) {
      return `${obj.endpoint}/routers`;
    }
  }
  return Router;
}
