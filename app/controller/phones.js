'use strict';
const Controller = require('egg').Controller;

function toInt(str) {
  if (typeof str === 'number') return str;
  if (!str) return str;
  return parseInt(str, 10) || 0;
}

class PhoneController extends Controller {
  async index() {
    const ctx = this.ctx;
    const query = { limit: toInt(ctx.query.limit), offset: toInt(ctx.query.offset), where: { del: 0 } };
    ctx.body = await ctx.model.Phone.findAll(query);
  }

  async show() {
    const ctx = this.ctx;
    ctx.body = await ctx.model.Phone.findByPk(toInt(ctx.params.id));
  }

  async create() {
    const ctx = this.ctx;
    const body = ctx.request.body;
    console.log(body);
    body.del = 0;
    const phone = await ctx.model.Phone.create({ ...body });
    ctx.status = 201;
    ctx.body = phone;
  }

  async update() {
    const ctx = this.ctx;
    const id = toInt(ctx.params.id);
    const phone = await ctx.model.Phone.findByPk(id);
    if (!phone) {
      ctx.status = 404;
      return;
    }

    const { del } = ctx.request.body;
    await phone.update({ id }, { del });
    ctx.body = phone;
  }

  async destroy() {
    const ctx = this.ctx;
    const id = toInt(ctx.params.id);
    const phone = await ctx.model.Phone.findByPk(id);
    if (!phone) {
      ctx.status = 404;
      return;
    }

    await phone.destroy();
    ctx.status = 200;
  }
}

module.exports = PhoneController;
