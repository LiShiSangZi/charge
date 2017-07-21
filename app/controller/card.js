'use strict';

exports.create = async(ctx) => {
  const body = ctx.request.body;
  const expire_date = body.expireDate || Date.now() + 30 * 3600000 * 24;
  const amount = body.amount || 50;
  let card = await ctx.model.Card.create({
    expire_date,
    amount,
  });
  card = card.dataValues;
  delete card['created_at'];
  delete card['updated_at'];
  ctx.body = {
    card,
  };
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
  } else if (c.used) {
    ctx.throw(409, 'The gift card is already used!');
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

  const c = await ctx.model.Card.findAll({
    limit,
    offset,
  });
  const cards = c.map(card => {
    const o = Object.assign({}, card.dataValues);
    o.expire_date = new Date(o.expire_date);
    if (o.charge_date) {
      o.charge_date = new Date(o.charge_date);
    }
    return o;
  });
  ctx.body = {
    cards,
  };
};