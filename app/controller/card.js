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
  const body = ctx.request.body;
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
    return o;
  });
  ctx.body = {
    cards,
  };
};