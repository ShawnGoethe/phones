'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  router.get('/', controller.home.index);
  router.get('/login', controller.login.index);
  router.post('/login/check', controller.login.check);

  router.get('/phone', controller.home.phone);
  router.get('/phoneAdmin', controller.home.phonesAdmin);

  router.get('/radom', controller.random.index);

  // resource
  router.resources('phones', '/phones', controller.phones);
};
