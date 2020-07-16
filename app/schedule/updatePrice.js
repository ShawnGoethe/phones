'use strict';
const Subscription = require('egg').Subscription;

class UpdatePrice extends Subscription {
  static get schedule() {
    return {
      interval: '5s',
      type: 'worker',
    };
  }
  async subscribe() {
    try {
      // const map = await this.ctx.service.taobao.getInfo();
      // console.log('schdule==>', JSON.stringify(map));
    } catch (e) {
      console.log('sss==>', e);
    }
  }
}

module.exports = UpdatePrice;
