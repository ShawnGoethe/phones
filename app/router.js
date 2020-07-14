'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  router.get('/', controller.home.index);
  router.get('/phone', controller.home.phone);
  router.get('/phonesCreate', controller.home.phonesCreate);

  router.get('/radom', controller.random.index);
  router.resources('phones', '/phones', controller.phones);
};
