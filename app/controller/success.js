('use strict');

module.exports = app => {
  class SuccessController extends app.Controller {
    * index() {
      console.log('aaaa');
      this.ctx.body = this.ctx.state.user;
    }
  }
  return SuccessController;
};
