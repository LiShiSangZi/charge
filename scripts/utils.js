'use strict';

const request = require('superagent');

/**
 * Mock the ctx and app.
 */

class ServiceBase extends Object {
  constructor(ctx) {
    super();
    this.ctx = ctx;
  }
}

class Context {
  constructor() {
    
  }
  async curl(url, opt) {

  }
}

const app = {
  service: ServiceBase,
  mockContext: function () {
    // Load all the service.

  }
};