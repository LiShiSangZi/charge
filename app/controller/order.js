'use strict';

exports.list = async ctx => {
  const userId = ctx.user.id;
  const limit = parseInt(ctx.query.limit, 10) || 10;
  const offset = parseInt(ctx.query.offset, 10) || 0;
  const status = ctx.query.status;
  const resource_id = ctx.query.resource_id;
  const opt = {
    user_id: userId,
  };
  if (status) {
    opt.status = status;
  }
  if (resource_id) {
    opt.resource_id = resource_id;
  }
  const order = await ctx.app.model.Order.findAndCounts(opt, limit, offset);
  const newOrders = order.rows.map(row => {
    const newRow = {};
    Object.keys(row.dataValues).forEach(k => {
      if (k === 'region') {
        newRow['region_id'] = row.region;
        return;
      }
      newRow[k] = row[k];
    });
    return newRow;
  });

  ctx.body = {
    orders: newOrders,
    total_count: order.count,
  };
};

exports.getTypes = async ctx => {
  ctx.body = {
    types: ["running", "deleted"],
  };
}

/**
 * Search the deduct for the order id.
 */
exports.detail = async ctx => {
  const limit = parseInt(ctx.query.limit, 10) || 10;
  const offset = parseInt(ctx.query.offset, 10) || 0;

  const orderId = ctx.params.orderId;
  const now = Date.now();
  const userId = ctx.user.id;

  const isOwner = await ctx.app.model.Order.isYourOrder(orderId, userId);
  if (isOwner) {
    const deduct = await ctx.app.model.Deduct.filterByOrder(orderId, limit, offset);

    if (deduct && deduct.rows && deduct.rows.length > 0) {
      const result = deduct.rows.map(row => {
        return {
          "end_time": row.updated_at,
          "remarks": row.remark,
          "start_time": row.created_at,
          "total_price": row.money,
          "unit": "hour",
          "unit_price": row.price,
        }
      });

      ctx.body = {
        bills: result,
        total_count: deduct.count,
      };
    }
  }
}