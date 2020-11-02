'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { INTEGER, DATE, STRING } = Sequelize;
    await queryInterface.createTable('brands', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      name: STRING(30),
      subname: STRING(30),
      ename: STRING(30),
      created_at: DATE,
      updated_at: DATE,
    });
  },

  down: async queryInterface => {
    await queryInterface.dropTable('brands');
  },
};
