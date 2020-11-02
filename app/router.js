'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  router.get('/', controller.home.index);
  router.get('/login', controller.login.index);
  router.post('/login/check', controller.login.check);
  router.post('/login/register', controller.login.register);

  // router.get('/', controller.home.phone);
  router.get('/phoneAdmin', app.jwt, controller.home.phonesAdmin);

  router.get('/radom', controller.random.index);

  // resource
  router.resources('phones', '/phones', controller.phones);
  router.resources('admins', '/admins', controller.admins);
  router.resources('brands', '/brands', controller.brands);
  router.resources('cpus', '/cpus', controller.cpus);
};
