'use strict';

const Controller = require('egg').Controller;
const fs = require('fs');
const Vue = require('vue');
const path = require('path');
const { createRenderer } = require('vue-server-renderer');


class HomeController extends Controller {
  async index() {
    try {
      const { ctx } = this;
      // const vueApp = new Vue({
      //   template: fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf-8'),
      // });
      // const renderer = createRenderer();
      // renderer.renderToString(vueApp, context, (err, html) => {
      //   ctx.body = html;
      // });
      ctx.response.type = 'html';
      ctx.response.body = fs.createReadStream(path.join(__dirname, '../public/index.html'));
    } catch (e) {
      console.log(e);
    }
  }
}

module.exports = HomeController;
