'use strict';

exports.keys = 'some secret hurr';
exports.chargeModule = {
  "modules": [{
    "name": "keystone",
    "keyField": "pipeline",
    "api": "keystone-paste.ini",
    "service": "httpd",
    "ignore": ["pipeline:public_version_api", "pipeline:admin_version_api"]
  }, {
    "name": "nova"
  }, {
    "name": "cinder"
  }, {
    "name": "neutron",
    "service": "neutron-server"
  }, {
    "name": "glance",
    "service": "openstack-glance-api",
    "api": "glance-api-paste.ini",
    "keyField": "pipeline",
    "ignore": ["pipeline:glance-api", "pipeline:glance-api-caching", "pipeline:glance-api-cachemanagement"]
  }],
  "key": "billing",
  "filter": {
    "paste.filter_factory": "billingmiddleware.billing:filter_factory",
    "billing_wsgi_url": "http://lb.2.stage.polex.io/${module}",
    "pre_ignore_method": "HEAD, TRACE, GET",
    "post_ignore_method": "HEAD, TRACE, GET"
  },
  "keycontext": ["keystonecontext", "authtoken", "context", "json_body", "url_normalize"]
};
/** 是否需要扫描旧表格，并且同步数据。默认为false，不需要。 */
exports.requireMerge = false;

exports.port = 7001;

exports.middleware = ['errorHandler', 'auth'];

const modules = exports.chargeModule.modules;
exports.auth = {
  ignoreLink: modules.map(module => module.name),
};
