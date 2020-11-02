'use strict';
const Controller = require('egg').Controller;

function toInt(str) {
  if (typeof str === 'number') return str;
  if (!str) return str;
  return parseInt(str, 10) || 0;
}

class CpusController extends Controller {
  async index() {
    const ctx = this.ctx;
    ctx.body = await ctx.model.Cpu.findAll();
  }

  async show() {
    const ctx = this.ctx;
    ctx.body = await ctx.model.Cpu.findByPk(toInt(ctx.params.id));
  }

  async create() {
    const ctx = this.ctx;
    const { name, age } = ctx.request.body;
    const Cpu = await ctx.model.Cpu.create({ name, age });
    ctx.status = 201;
    ctx.body = Cpu;
  }

  async update() {
    const ctx = this.ctx;
    const id = toInt(ctx.params.id);
    const Cpu = await ctx.model.Cpu.findByPk(id);
    if (!Cpu) {
      ctx.status = 404;
      return;
    }

    const { name, age } = ctx.request.body;
    await Cpu.update({ name, age });
    ctx.body = Cpu;
  }

  async destroy() {
    const ctx = this.ctx;
    const id = toInt(ctx.params.id);
    const Cpu = await ctx.model.Cpu.findByPk(id);
    if (!Cpu) {
      ctx.status = 404;
      return;
    }

    await Cpu.destroy();
    ctx.status = 200;
  }
}

module.exports = CpusController;
