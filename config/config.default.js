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
    username: 'root',
    password: 'lpclpyzzh2012',
    dialect: 'mysql',
    host: '39.105.25.74',
    port: 3306,
    database: 'phones',
  };
  config.siteFile = {
    '/favicon.ico': fs.readFileSync('favicon.ico'),
  };
  config.alinode = {
    enable: true,
    server: 'wss://agentserver.node.aliyun.com:8080',
    appid: '85891',
    secret: '8f402837e41341b75fcb22bb8a5df8c588e39497',
  };
  config.jwt = {
    secret: 'zzestlgcjwtsecret',
    getToken(ctx) {

      if (
        ctx.headers.authorization && (ctx.headers.authorization.split(' ')[0] === '\"Bearer' ||
          ctx.headers.authorization.split(' ')[0] === 'Token')
      ) {
        let token = ctx.headers.authorization.split(' ')[1];
        token = token.substring(0, token.length - 1);
        return token;
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

  return {
    ...config,
    ...userConfig,
  };
};
