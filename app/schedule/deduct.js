'use strict';

module.exports = app => {
  const triggerMin = app.config.schedule.triggerMin || 0;
  return {
    schedule: {
      cron: `${triggerMin} * * * *`,
      // cron: `* * * * *`,
      type: 'worker',
    },

    async task(ctx) {
      const nowNum = Date.now();

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

      const t = await ctx.app.model.transaction();

      for (let index = 0; index < deducts.length; index++) {
        const deduct = deducts[index];
        const order = orders[deduct.order_id];
        if (!order || order.status === 'deleted' ||
          order.deduct_id !== deduct.deduct_id) {
          // The order is inactive.
          continue;
        }

        const project = projects.get(order.project_id);
        if (!project || !project.user_id) {
          continue;
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
        const r = await ctx.service.utils.order.calOrder(order, deduct, project,
          user, false, newDeduct, t);

      }

      for (let proIndex = 0; proIndex < projects.length; proIndex++) {
        const proj = projects[proIndex];
        await proj.save({
          transaction: t,
        });
      }
      for (let userIndex = 0; userIndex < users.length; userIndex++) {
        const user = users[userIndex];

        await ctx.service.account.setAccount(user, {
          transaction: t,
        });
      }
      t.commit();

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