'use strict';
const Subscription = require('egg').Subscription;

class UpdatePrice extends Subscription {
  static get schedule() {
    return {
      interval: '5d',
      type: 'worker',
    };
  }
  async subscribe() {
    try {
      const results = await this.ctx.service.taobao.getInfo();
      console.log('results', results);
    } catch (e) {
      console.log('e==>', e);
    }
  }
}

module.exports = UpdatePrice;
