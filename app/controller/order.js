'use strict';

exports.list = async ctx => {
  const userId = ctx.user.id;
  const limit = parseInt(ctx.query.limit, 10);
  const offset = parseInt(ctx.query.offset, 10);
  const order = await ctx.app.model.Order.findAndCounts(userId, limit, offset);
  ctx.body = {
    orders: order.rows,
    total_count: order.count,
  };
};

/**
 * Search the deduct for the order id.
 */
exports.detail = async ctx => {
  const limit = parseInt(ctx.query.limit, 10);
  const offset = parseInt(ctx.query.offset, 10);

  const orderId = ctx.params.orderId;
  const now = Date.now();

  const deduct = await ctx.app.model.Deduct.filterByOrder(orderId, limit, offset);

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