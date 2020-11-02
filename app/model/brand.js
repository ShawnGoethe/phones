'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE } = app.Sequelize;

  const Brand = app.model.define('brand', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: STRING(30),
    subname: STRING(30),
    ename: STRING(30),
    createdAt: DATE,
    updatedAt: DATE,
  });

  return Brand;
};
