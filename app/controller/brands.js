'use strict';
const Controller = require('egg').Controller;

function toInt(str) {
  if (typeof str === 'number') return str;
  if (!str) return str;
  return parseInt(str, 10) || 0;
}

class BrandsController extends Controller {
  async index() {
    const ctx = this.ctx;
    ctx.body = await ctx.model.Brand.findAll();
  }

  async show() {
    const ctx = this.ctx;
    ctx.body = await ctx.model.Brand.findByPk(toInt(ctx.params.id));
  }

  async create() {
    const ctx = this.ctx;
    const { name, age } = ctx.request.body;
    const Brand = await ctx.model.Brand.create({ name, age });
    ctx.status = 201;
    ctx.body = Brand;
  }

  async update() {
    const ctx = this.ctx;
    const id = toInt(ctx.params.id);
    const Brand = await ctx.model.Brand.findByPk(id);
    if (!Brand) {
      ctx.status = 404;
      return;
    }

    const { name, age } = ctx.request.body;
    await Brand.update({ name, age });
    ctx.body = Brand;
  }

  async destroy() {
    const ctx = this.ctx;
    const id = toInt(ctx.params.id);
    const Brand = await ctx.model.Brand.findByPk(id);
    if (!Brand) {
      ctx.status = 404;
      return;
    }

    await Brand.destroy();
    ctx.status = 200;
  }
}

module.exports = BrandsController;
