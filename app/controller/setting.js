'use strict';

exports.list = async ctx => {
  const settings = await ctx.model.Setting.getSettings();
  ctx.body = settings;
};

exports.detail = async ctx => {
  const key = ctx.params.key;
  const setting = await ctx.model.Setting.getSetting(key);
  if (!setting) {
    ctx.throw(404, "Not Found!");
    return;
  }
  ctx.body = setting;
}

exports.create = async ctx => {
  const body = ctx.request.body;

  ['value', 'key'].forEach(key => {
    if (typeof body[key] === 'undefined') {
      ctx.throw(400, `${key} is required!`);
    }
  });

  await ctx.model.Setting.setSetting(body);
  ctx.body = 'Done';
}