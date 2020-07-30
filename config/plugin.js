'use strict';

/** @type Egg.EggPlugin */
module.exports = {
  // had enabled by egg
  // static: {
  //   enable: true,
  // }
  sequelize: {
    enable: true,
    package: 'egg-sequelize',
  },
  jwt: {
    enable: true,
    package: 'egg-jwt',
  },
  xtransit: {
    enable: true,
    package: 'egg-xtransit',
  },
  validate: {
    enable: true,
    package: 'egg-validate',
  },
};
