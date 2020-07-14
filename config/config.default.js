/* eslint valid-jsdoc: "off" */

'use strict';
const path = require('path');

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
