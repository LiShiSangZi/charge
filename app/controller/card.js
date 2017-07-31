'use strict';

exports.create = async(ctx) => {
  const body = ctx.request.body;
  let expire_date = body.expireDate || Date.now() + 30 * 3600000 * 24;
  const d = new Date(expire_date);
  const remark = body.remark;
  if (remark.length > 64) {
    ctx.throw(400, 'The remark length should less than 64!');
  }

  d.setHours(23, 59, 59, 999);
  expire_date = d.getTime();
  if (expire_date < Date.now()) {
    ctx.throw(400, 'The expire date should not earlier than now!');
  }
  const amount = body.amount || 50;
  if (amount < 1) {
    ctx.throw(400, 'The amount should be positive!');
  }
  const count = body.count || 1;
  if (count < 1) {
    ctx.throw(400, 'The amount should be positive!');
  }
  const list = [];
  for (let i = 0; i < count; i++) {
    list[i] = {
      expire_date,
      amount,
      remark,
    };
  }
  let cards = await ctx.model.Card.bulkCreate(list);
  cards = cards.map(card => {
    const c = Object.assign({}, card.dataValues);
    c.expire_date = new Date(c.expire_date);
    delete c['created_at'];
    delete c['updated_at'];
    return c;
  });
  ctx.body = {
    cards,
  };
};

exports.delete = async(ctx) => {
  const id = ctx.params.id;
  if (typeof id === 'undefined') {
    ctx.throw(400, 'The id is required!');
  }
  const t = await ctx.model.transaction();
  const c = await ctx.model.Card.findOne({
    where: {
      card_id: id,
    },
    transaction: t,
  });
  if (!c) {
    ctx.throw(404);
    t.commit();
    return;
  } else if (c.used || Date.now() > c.expire_date) {
    ctx.throw(409, 'The gift card is already used or expired!');
    t.commit();
    return;
  }
  await c.destroy({
    transaction: t,
  });
  t.commit();
  ctx.status = 202;
};

exports.charge = async(ctx) => {
  const id = ctx.params.id;
  if (typeof id === 'undefined') {
    ctx.throw(400, 'The id is required!');
  }
  const t = await ctx.model.transaction();
  const c = await ctx.model.Card.findOne({
    where: {
      card_id: id,
    },
    transaction: t,
  });
  if (!c) {
    ctx.throw(404);
  } else if (c.used || Date.now() > c.expire_date) {
    ctx.throw(409, 'The gift card is already used or expired!');
  } else {
    c.used = true;
    c.charge_date = Date.now();
    c.charge_id = ctx.user.id;
    c.charge_user = ctx.user.name;
    try {
      await c.save({
        transaction: t,
      });
      const query = {
        "type": "gift card",
        "operator": ctx.user.id,
        "amount": c.amount,
      };
      const chargeRec = await ctx.app.model.Charge.create(query, {
        transaction: t,
      });

      if (chargeRec) {
        const account = await ctx.app.model.Account.getAccountById(ctx.user.id, t);
        if (!account.balance) {
          account.balance = 0;
        }
        const addValue = c.amount;
        account.balance += addValue;

        await ctx.service.account.setAccount(account, {
          transaction: t,
        });

        if (account.reward_value === null) {
          account.reward_value = addValue;
        } else {
          account.reward_value += addValue;
        }
        if (account.reward_value < 0) {
          account.reward_value = 0;
        }

        account.save({
          transaction: t,
        });
      }
      const card = Object.assign(c.dataValues, {});
      card.expire_date = new Date(card.expire_date);
      card.charge_date = new Date(card.charge_date);
      ctx.body = {
        card,
      };
    } catch (e) {
      t.rollback();
      ctx.throw(500, e);
      return;
    }
  }
  t.commit();
}

exports.show = async(ctx) => {
  const id = ctx.params.id;
  if (typeof id === 'undefined') {
    ctx.throw(400, 'The id is required!');
  }

  const c = await ctx.model.Card.findOne({
    where: {
      card_id: id,
    },
  });
  if (!c) {
    ctx.throw(404);
  } else {
    const card = Object.assign(c.dataValues, {});
    card.expire_date = new Date(card.expire_date);
    if (card.charge_date) {
      card.charge_date = new Date(card.charge_date);
    }

    ctx.body = {
      card,
    };
  }
}

exports.list = async(ctx) => {

  const limit = parseInt(ctx.query.limit, 10) || 10;
  const offset = parseInt(ctx.query.offset, 10) || 0;

  let u = ctx.query.used;

  let expire_date = parseInt(ctx.query.expire_date, 10);
  if (isNaN(expire_date)) {
    expire_date = undefined;
  } else {
    u = 'false';
  }

  const o = {
    limit,
    offset,
    order: [
      ['updated_at', 'DESC']
    ],
  }
  if (typeof u !== 'undefined') {
    let used;
    // if expire_date is specific, will query card that is not used.
    if (u === 'true') {
      used = true;
    } else {
      used = false;
    }
    o.where = {
      used,
    };

    if (expire_date) {
      o.where.expire_date = {
        $gt: expire_date,
      };
    }
  }


  const c = await ctx.model.Card.findAndCountAll(o);
  const cards = c.rows.map(card => {
    const o = Object.assign({}, card.dataValues);
    o.expire_date = new Date(o.expire_date);
    if (o.charge_date) {
      o.charge_date = new Date(o.charge_date);
    }
    return o;
  });
  ctx.body = {
    count: c.count,
    cards,
  };
};