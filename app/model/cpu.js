'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE } = app.Sequelize;

  const Cpu = app.model.define('cpu', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: STRING(30),
    brand: STRING(30),
    createdAt: DATE,
    updatedAt: DATE,
  });

  return Cpu;
};
