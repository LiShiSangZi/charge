'use strict';

/**
 * Service to calculate the price for the product and amount.
 */

const calNumber = (num) => {
  return Math.round(num * 10000) / 10000;
}

module.exports = app => {
  class PriceEngine extends app.Service {
    calculatePrice(priceObj, amount) {
      const {
        base_price,
        segmented,
        type,
      } = priceObj.price;
      let price = parseFloat(base_price);
      if (type === 'segmented' && segmented && segmented.length > 0) {
        // TODO: Add segmented price here.
        segmented.sort((a, b) => a.count - b.count);
        let index = 0;
        while (segmented[index] && segmented[index].count < amount) {
          index++;
        }
        if (index >= segmented.length) {
          index--;
        }
        if (segmented[index] && segmented[index].price) {
          return calNumber(segmented[index].price * amount);
        }
      }
      return calNumber(price * amount);
    }
  }
  return PriceEngine;
}