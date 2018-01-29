'use strict';

const DAY_MS = 3600000 * 24;
/**
 * get latest expense, created or deleted resource statistics
 * according to the start and end time in ms.
 */
exports.order = async ctx => {
  const { model } = ctx;
  const { Order } = model;
  let { start, end } = ctx.query;

  if (!start) {
    ctx.status = 400;
    ctx.body = {
      message: 'The start timestamp is required!'
    };
    return;
  }

  start = new Date(parseInt(start, 10));
  start.setHours(0, 0, 0, 0);
  start = start.getTime();

  if (!end) {
    end = Date.now();
  }
  end = new Date(parseInt(start, 10));
  end.setHours(0, 0, 0, 0);
  end = end.getTime() + DAY_MS;

  /** Last created resource. */
  const createdOrders = await model.query(
    `SELECT resource_id, order_id, status, type, created_at, updated_at 
FROM \`order\` 
GROUP BY resource_id HAVING MIN(created_at) >= :start AND MIN(created_at) < :end`,
    {
      replacements: {
        start,
        end
      },
      type: model.QueryTypes.SELECT
    }
  );

  /** Last elimated resource. */
  const deletedOrders = await model.query(
    `SELECT resource_id, order_id, status, type, created_at, updated_at 
FROM \`order\` 
GROUP BY resource_id HAVING MAX(updated_at) >= :start AND MAX(updated_at) < :end AND 'deleted' = GROUP_CONCAT(distinct status)`,
    {
      replacements: {
        start,
        end
      },
      type: model.QueryTypes.SELECT
    }
  );

  /** Last expense for all resource. */
  const expenseSummary = await model.query(
    `SELECT sum(money) AS expense
FROM deduct 
WHERE created_at >= :start AND created_at < :end`,
    {
      replacements: {
        start,
        end
      },
      type: model.QueryTypes.SELECT
    }
  );

  ctx.body = {
    created: createdOrders.length,
    deleted: deletedOrders.length,
    expense: expenseSummary[0].expense
  };
};
