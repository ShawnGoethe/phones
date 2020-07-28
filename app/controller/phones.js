'use strict';
const Controller = require('egg').Controller;
const { Op } = require('sequelize');

function toInt(str) {
  if (typeof str === 'number') return str;
  if (!str) return str;
  return parseInt(str, 10) || 0;
}

class PhoneController extends Controller {
  async index() {
    const ctx = this.ctx;
    const search = ctx.query.search;
    const query = {
      limit: toInt(ctx.query.limit),
      offset: toInt(ctx.query.offset),
      where: {
        del: 0,
      },
      order: [ 'id', 'DESC' ],
      };
      if (search) {
       const or = [
         { name: { [Op.like]: '%' + search + '%' } },
         { cpu: { [Op.like]: '%' + search + '%' } },
         { inch: { [Op.like]: '%' + search + '%' } },
         { battery: { [Op.like]: '%' + search + '%' } },
         { rearMax: { [Op.like]: '%' + search + '%' } },
         { frontMax: { [Op.like]: '%' + search + '%' } },
         { cg: { [Op.like]: '%' + search + '%' } },
        ];
       query.where[Op.or] = [];
       query.where[Op.or] = or;
      }
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
    const params = ctx.request.body;
    const res = ctx.model.Phone.update(params, {
      where: {
        id,
      },
    });
    ctx.body = res;
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
