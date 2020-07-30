/* eslint valid-jsdoc: "off" */

'use strict';
const fs = require('fs');

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = exports = {};

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1586660346758_9852';

  // add your middleware config here
  config.middleware = [];

  // add your user config here
  const userConfig = {
    // myAppNamme: 'egg',
  };
  config.sequelize = {
    username: 'mall',
    password: 'MALL',
    dialect: 'mysql',
    host: '39.105.25.74',
    port: 3306,
    database: 'phones',
  };
  config.siteFile = {
    '/favicon.ico': fs.readFileSync('favicon.ico'),
  };
  config.jwt = {
    secret: 'zzestlgcjwtsecret',
    getToken(ctx) {
      if (
        ctx.headers.authorization &&
        (ctx.headers.authorization.split(' ')[0] === 'Bearer' ||
          ctx.headers.authorization.split(' ')[0] === 'Token')
      ) {
        return ctx.headers.authorization.split(' ')[1];
      } else if (ctx.query && ctx.query.token) {
        return ctx.query.token;
      }
      return null;
    },
  };
  config.security = {
    csrf: {
      enable: false,
    },
  };
  config.xtransit = {
    server: 'ws://120.27.24.200:7070',
    appId: 1,
    appSecret: 'f7b99d08cc0193106690860047b28970',
  };

  return {
    ...config,
    ...userConfig,
  };
};
