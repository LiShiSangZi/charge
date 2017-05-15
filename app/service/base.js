'use strict';

/**
 * Base class for the common service.
 * 
 */
module.exports = (app) => {
  class BaseService extends app.Service {
    constructor(ctx) {
      super(ctx);
    }
    async POST(region, body) {
      console.log('POST', region);
      await this.getProduct(region, body);
    }
    async GET(region, body) {
      console.log('GET', region);
      await this.getProduct(region, body);
      return 'abc';
    }
    getProductName(body) {
      return body;
    }
    async getProduct(region, body) {
      console.log('getProduct', region, body);
      const name = this.getProductName(body);
      const res = await this.ctx.model.Product.findProduct(region, 'compute', name);
    }
  }
  return BaseService;
}
