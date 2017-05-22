'use strict';


module.exports = app => {

  const APIVERSION = 'v2';

  /**
   * API for the products
   */
  app.get(`/${APIVERSION}/products`, 'product.list');
  app.get(`/${APIVERSION}/products/detail`, 'product.detail');
  app.post(`/${APIVERSION}/products`, 'product.create');
  app.delete(`/${APIVERSION}/products/:product_id`, 'product.delete');
  app.put(`/${APIVERSION}/products/:product_id`, 'product.update');
  app.get(`/${APIVERSION}/products/price`, 'product.showPrice');

  app.get(`/${APIVERSION}/accounts/:userId`, 'account.detail');
  app.put(`/${APIVERSION}/accounts/:userId`, 'account.charge');
  app.put(`/${APIVERSION}/accounts/:userId/level`, 'account.setLevel');
  app.get(`/${APIVERSION}/accounts`, 'account.list');
  app.post(`/${APIVERSION}/accounts`, 'account.create');

  /**
   * API for the charge record.
   */
  app.get(`/${APIVERSION}/accounts/charges/:userId`, 'charge.list');
  
  /**
   * API for the order.
   */
  app.get(`/${APIVERSION}/orders`, 'order.list');
  app.get(`/${APIVERSION}/orders/types`, 'order.getTypes');
  app.get(`/${APIVERSION}/orders/:orderId`, 'order.detail');
  

  app.all('/:module', 'middleware.catch');
}