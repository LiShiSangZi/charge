'use strict';

exports.listSelect = async ctx => {
  const t = await ctx.app.model.transaction();
  var orders = {}
  if (ctx.request.body.resource_ids) {
    const resourceIds = ctx.request.body.resource_ids;
    for (let id in resourceIds) {
      const allOrders = await ctx.app.model.Order.findAllOrderByResource(resourceIds[id], ctx.request.header.region);
      orders[resourceIds[id]]=[allOrders[0], allOrders[allOrders.length-1]];
    }
  } else {
    ctx.throw(400, "only order ids and resource ids accept!");
  }
  ctx.body = {
    orders: orders,
  };
}

exports.list = async ctx => {
  const userId = ctx.user.id;
  const limit = parseInt(ctx.query.limit, 10) || 10;
  const offset = parseInt(ctx.query.offset, 10) || 0;
  const status = ctx.query.status;
  const resource_id = ctx.query.resource_id;
  const type = ctx.query.type;
  const detail = ctx.query.detail;
  const opt = {
    user_id: userId,
  };
  if (status) {
    opt.status = status;
  }
  if (resource_id) {
    opt.resource_id = resource_id;
  }
  if (type) {
    opt.type = type;
  }

  const t = await ctx.app.model.transaction();

  const order = await ctx.app.model.Order.findAndCounts(opt, limit, offset, t);

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

  if (detail === 'true' || detail === true) {
    const meta = await ctx.app.model.OrderMeta.findByOrderIds(newOrders.map(o => o.order_id), t);
    // Group the data.
    const metaDict = new Map();
    meta.forEach(m => {
      const info = {

      }
      if (m.type === 'number') {
        info[m.name] = parseFloat(m.value);
      } else if (m.type === 'object') {
        info[m.name] = JSON.parse(m.value);
      } else if (m.type === 'undefined') {
        info[m.name] = undefined;
      } else {
        info[m.name] = m.value;
      }
      const orderId = m.order_id;
      let node = metaDict.get(orderId);
      if (!node) {
        node = info;
        metaDict.set(orderId, node);
      } else {
        node[m.name] = info[m.name];
      }
    });

    newOrders.forEach(order => {
      const node = metaDict.get(order.order_id);
      if (node) {
        order.metaData = node;
      }
    });
  }
  await t.commit();
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
 * Create realtime order.
 */
exports.createRealtime = async ctx => {
  const body = ctx.request.body;
  if (!body.data) {
    ctx.throw(400);
  }
  const t = await ctx.app.model.transaction();

  const accountMaps = await ctx.app.model.Account.listAccountMap(t);
  let found = true;

  for (let i = 0; i < body.data.length; i++) {
    const orderData = body.data[i].data;
    const userId = body.data[i].userId;
    const userObj = accountMaps.get(userId);

    if (!userObj) {
      found = false;
      break;
    }

    const order = await ctx.app.model.Order.createOrder({
      "region": orderData.region,
      "resource_name": orderData.resource_name,
      "resource_id": orderData.resource_id,
      "type": orderData.type,
      "unit_price": orderData.unit_price,
      "unit": "hour",
      "total_price": orderData.total_price,
      "user_id": userId,
    }, t);

    if (orderData.meta) {
      for (let i = 0; i < orderData.meta.length; i++) {
        const meta = orderData.meta;
        await ctx.model.OrderMeta.createMeta({
          "resource_id": orderData.resource_id,
          "order_id": order.order_id,
          "name": meta.name,
          "type": meta.type,
          "value": meta.value,
        }, t);
      }
    }

    userObj.consumption += orderData.total_price;
    if (userObj.reward_value < orderData.total_price) {
      userObj.reward_value = 0;
    } else {
      userObj.reward_value = userObj.reward_value - orderData.total_price;
    }
    userObj.balance -= orderData.total_price;


    // await userObj.save({
    //   transaction: t,
    // });
    await ctx.service.account.setAccount(userObj, {
      transaction: t,
    });
  }

  if (!found) {
    ctx.throw(400, "Some users are not available!");
    t.rollback();
    return;
  }
  t.commit();
  ctx.body = 'Done';
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

exports.close = async ctx => {
  const resourceId = ctx.params.resourceId;
  const userId = ctx.params.userId;
  const opt = {
    "requestUrl": resourceId,
  };
  const result = ctx.service.common.DELETE(opt);
  ctx.body = {result: result};
}