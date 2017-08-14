'use strict';

const uuidV4 = require('uuid/v4');
/**
 * Utils method for orders.
 */
module.exports = (app) => {
  class BaseService extends app.Service {
    /**
     * Calculate the order. It will return a list of promise if any save work is necessary.
     * @param {*OrderInstance} order instance.
     * @param {*DeductInstance} deduct NULL will create a new deduct.
     * @param {*ProjectInstance} project the related project.
     * @param {*UserInstance} user the related user.
     * @param {Boolean} close will close the order if true.
     * @param {Boolean} createNew will create a new deduct.
     * @param {*Transaction} transaction db transaction.
     * @param {Number} timestamp the timestamp in seconds.
     */
    async calOrder(order, deduct, project, user, close, createNew, transaction, timestamp) {
      if (!deduct || (deduct && order.deduct_id !== deduct.deduct_id)) {
        // The deduct is not current one.
        return;
      }

      const addOpt = {};
      if (transaction) {
        addOpt.transaction = transaction;
      }

      let priceUnit = 3600;
      switch (order.unit) {
        case 'hour':
          priceUnit = 3600;
          break;
      }

      const priceInSec = order.unit_price / priceUnit;
      const now = timestamp || Math.floor(Date.now() / 1000);


      const lastUpdate = Math.floor(deduct.created_at.getTime() / 1000);
      const duration = now - lastUpdate;
      const totalCharge = duration * priceInSec;
      let chMoney = totalCharge - deduct.get('money');
      if (chMoney < 0) {
        chMoney = 0;
      }
      deduct.set('money', parseFloat(totalCharge.toFixed(4)));
      deduct.set('updated_at', (now - 1) * 1000);

      await deduct.save(addOpt);
      if (createNew) {
        const uuid = uuidV4();
        // Create a new empty deduct.
        await this.ctx.app.model.Deduct.create({
          deduct_id: uuid,
          resource_id: order.resource_id,
          type: order.type,
          order_id: order.order_id,
          money: 0,
          price: order.unit_price,
          updated_at: now * 1000,
          created_at: now * 1000,
        }, addOpt);
        order.deduct_id = uuid;
      }
      order.total_price += chMoney;

      if (close) {
        // close the order:
        order.set('status', 'deleted');
      }


      // Find the project:
      if (project) {
        project.consumption += chMoney;

        if (project.user_id) {

          user.consumption += chMoney;
          if (user.reward_value < chMoney) {
            user.reward_value = 0;
          } else {
            user.reward_value = user.reward_value - chMoney;
          }
          user.balance -= chMoney;
          order.user_id = user.user_id;
        }
      } else {
        /**
         * TODO: The project is no longer available. We should do something.
         */
      }
      await order.save(addOpt);
    }
  }

  return BaseService;
};
