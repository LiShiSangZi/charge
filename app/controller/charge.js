'use strict';

exports.list = async (ctx) => {
  const userId = ctx.params.userId;
  const limit = parseInt(ctx.query.limit, 10);
  const offset = parseInt(ctx.query.offset, 10);

  const res = await ctx.model.Charge.fetchCharge(userId, limit, offset);
  const output = {};
  output.charges = res.rows.map(row => {
    return {
      "actor": {
        "user_id": row.operator,
      },
      "charge_id": row.charge_id,
      "charge_time": row.created_at,
      "come_from": row.come_from || '',
      "target": {
        "user_id": row.user_id,
      },
      "type": row.type,
      "value": row.amount.toFixed(4),
    };
  });
  output.total_count = res.count;

  ctx.body = output;
}
