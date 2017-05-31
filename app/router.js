'use strict';


module.exports = app => {

  const APIVERSION = 'v2';

  /**
   * API for the products
   */
  app.get(`/${APIVERSION}/products`, app.middlewares.adminAuth(), 'product.list');
  app.get(`/${APIVERSION}/products/detail`, app.middlewares.adminAuth(), 'product.detail');
  app.post(`/${APIVERSION}/products`, app.middlewares.adminAuth(), 'product.create');
  app.delete(`/${APIVERSION}/products/:product_id`, app.middlewares.adminAuth(), 'product.delete');
  app.put(`/${APIVERSION}/products/:product_id`, app.middlewares.adminAuth(), 'product.update');
  app.get(`/${APIVERSION}/products/price`, app.middlewares.adminAuth(), 'product.showPrice');

  // app.get(`/${APIVERSION}/products`, 'product.list');
  // app.get(`/${APIVERSION}/products/detail`, 'product.detail');
  // app.post(`/${APIVERSION}/products`, 'product.create');
  // app.delete(`/${APIVERSION}/products/:product_id`, 'product.delete');
  // app.put(`/${APIVERSION}/products/:product_id`, 'product.update');
  // app.get(`/${APIVERSION}/products/price`, 'product.showPrice');

  app.get(`/${APIVERSION}/accounts/:userId`, app.middlewares.userAuth(), 'account.detail');
  app.put(`/${APIVERSION}/accounts/:userId`, app.middlewares.adminAuth(), 'account.charge');
  app.put(`/${APIVERSION}/accounts/:userId/level`, app.middlewares.adminAuth(), 'account.setLevel');
  app.get(`/${APIVERSION}/accounts`, 'account.list');
  app.post(`/${APIVERSION}/accounts`, app.middlewares.adminAuth(), 'account.create');

  /**
   * API for the product setting.
   */
  app.get(`/${APIVERSION}/settings`, app.middlewares.adminAuth(), 'setting.list');
  app.get(`/${APIVERSION}/settings/:key`, app.middlewares.adminAuth(), 'setting.detail');
  app.post(`/${APIVERSION}/settings`, app.middlewares.adminAuth(), 'setting.create');

  /**
   * API for the charge record.
   */
  app.get(`/${APIVERSION}/accounts/charges/:userId`, app.middlewares.userAuth(), 'charge.list');
  
  /**
   * API for the order.
   */
  app.get(`/${APIVERSION}/orders`, 'order.list');
  app.get(`/${APIVERSION}/orders/types`, 'order.getTypes');
  app.get(`/${APIVERSION}/orders/:orderId`, 'order.detail');
  

  app.all('/:module', 'middleware.catch');
}