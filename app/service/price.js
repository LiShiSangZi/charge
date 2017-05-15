'use strict';

/**
 * Service to calculate the price for the product and amount.
 */

module.exports = app => {
  class PriceEngine extends app.Service {
    calculatePrice(priceObj, amount) {
      const {
        base_price,
        segmented,
        type,
      } = priceObj.price;
      let price = parseFloat(base_price);
      if (type === 'segmented') {
        // TODO: Add segmented price here.
      }
      return price * amount;
    }
  }
  return PriceEngine;
}
