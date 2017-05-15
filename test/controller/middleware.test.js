'use strict';

const assert = require('assert');
const mock = require('egg-mock');
const request = require('supertest');

describe('test/controller/middleware.test.js', () => {
  let app;
  before(() => {
    app = mock.app();
    return app.ready();
  });
  afterEach(mock.restore);

  it('should process keypair', () => {
    return request(app.callback())
      .post('http://10.0.101.53:7001/nova')
      .send({
        "keypair": {
          "name": "keypair-a31b4d51-6123-4b71-1731-10b431a89c71"
        }
      });
  });
});
