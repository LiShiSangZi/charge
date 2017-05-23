'use strict';

module.exports = app => {
  const triggerMin = app.config.schedule.triggerMin || 0;
  return {
    schedule: {
      cron: `0 ${triggerMin} * * * *`,
      type: 'worker',
    },

    async task(ctx) {
      console.log(new Date(), 'Start');
      const users = await ctx.app.model.Account.listAccountMap();

      const projects = await ctx.app.model.Project.listProductMap();

      const orders = await ctx.app.model.Order.buildOrderDict();

      const deducts = await ctx.app.model.Deduct.listAll();

      const now = Date.now();
      const saveCurrentTimestamp = now;

      const nowDate = new Date(now);
      if (ctx.app.config.schedule.singleOrderDuration == 'h') {
        nowDate.setHours(nowDate.getHours(), 0, 0, 0);
      } else if (ctx.app.config.schedule.singleOrderDuration == 'm') {
        nowDate.setHours(nowDate.getHours(), nowDate.getMinutes(), 0, 0);
      } else {
        nowDate.setHours(0, 0, 0, 0);
      }
      const nowDateTimestamp = nowDate.getTime();

      // const needNewDeduct = nowDate.getHours() < 1;
      // const needNewDeduct = true;
      let promises = [];
      let promiseIndex = 0;
      deducts.forEach((deduct, index) => {
        const order = orders[deduct.order_id];
        if (!order || order.status === 'deleted') {
          // The order is inactive.
          return;
        }

        if (order.deduct_id !== deduct.deduct_id) {
          // The deduct is not current one.
          return;
        }
        const project = projects.get(order.project_id);
        if (!project || !project.user_id) {
          return;
        }
        const user = users.get(project.user_id);
        let newDeduct = false;
        const original = new Date(deduct.created_at);
        if (ctx.app.config.schedule.singleOrderDuration == 'h') {
          // 按小时分deduct:
          original.setHours(original.getHours(), 0, 0, 0);
          if (nowDateTimestamp - original.getTime() >= 3600000) {
            newDeduct = true;
          }
        } else if (ctx.app.config.schedule.singleOrderDuration == 'd') {
          // 按天分deduct:
          original.setHours(0, 0, 0, 0);
          if (nowDateTimestamp - original.getTime() >= 3600000 * 24) {
            newDeduct = true;
          }
        } else if (ctx.app.config.schedule.singleOrderDuration == 'm') {
          // 按分钟分deduct:
          original.setHours(original.getHours(), original.getMinutes(), 0, 0);
          if (nowDateTimestamp - original.getTime() >= 60000) {
            newDeduct = true;
          }
        }

        const r = ctx.service.utils.order.calOrder(order, deduct, project,
          user, false, newDeduct);
        promises = promises.concat(r);
        promiseIndex += r.length;

      });

      projects.forEach(proj => {
        promises[promiseIndex++] = proj.save();
      });

      users.forEach(user => {
        promises[promiseIndex++] = user.save();
      });

      await Promise.all(promises);

      // Remove the frozen data more than an hour.
      const critical = Date.now() - 3600000;
      await ctx.app.model.Frozen.destroy({
        where: {
          updated_at: {
            $lt: critical,
          },
        },
      });
    }
  }
}