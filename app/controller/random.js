'use strict';

const Controller = require('egg').Controller;

class RandomController extends Controller {
    async index() {
        try {
            const { ctx } = this;
            ctx.body = Math.random();
        } catch (e) {
            console.log(e);
        }
    }
}

module.exports = RandomController;
