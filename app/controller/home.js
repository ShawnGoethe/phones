'use strict';

const Controller = require('egg').Controller;
const fs = require('fs');
const path = require('path');
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
  async phone() {
    const { ctx } = this;
    // const phone = await ctx.model.Phone.findAll();
    // // console.log('phone===>', phone[0].dataValues);
    // const template = require('fs').readFileSync(path.join(__dirname, '../public/phone.html'), 'utf-8');
    // const renderer = createRenderer({
    //   template,
    // });
    // const context = {
    //   title: 'phone',
    //   phoneData: [
    //     {
    //       id: 0,
    //       name: 'xiaomi',
    //       price: 3999,
    //       inch: 5.9,
    //       nfc: 1, charging: 65,
    //     },
    //   ],
    // };
    // const app = new Vue({
    //   data() {
    //     return {
    //       // phoneData: [ phone[0].dataValues ],
    //       message: 'hello',
    //       phoneData: [
    //         {
    //           id: 0,
    //           name: 'xiaomi',
    //           price: 3999,
    //           inch: 5.9,
    //           nfc: 1, charging: 65,
    //         },
    //       ],
    //     };
    //   },
    //   template,
    // });
    // console.log([ phone[0].dataValues ]);

    // renderer.renderToString(app, context, (err, html) => {
    //   // console.log(html);
    //   if (err) {
    //     ctx.body = err;
    //     return;
    //   }
    //   ctx.body = html;
    // });
    ctx.response.type = 'html';
    ctx.response.body = fs.createReadStream(path.join(__dirname, '../public/phone.html'));
  }
  async phonesCreate() {
    const { ctx } = this;
    ctx.response.type = 'html';
    ctx.response.body = fs.createReadStream(path.join(__dirname, '../public/admin.html'));
  }
}

module.exports = HomeController;
