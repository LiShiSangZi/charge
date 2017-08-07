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
    async DELETE(opt) {
      if (/portforwarding/.test(opt.requestUrl)) {
        return;
      }
      return await super.DELETE(opt);
    }
    async POST(opt) {
      const request = opt.request;
      const keys = Object.keys(request);
      if (keys.indexOf('portforwarding') >= 0) {
        return;
      }
      return await super.POST(opt);
    }
  }
  return Router;
}
