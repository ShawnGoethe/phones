'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { INTEGER, DATE, STRING } = Sequelize;
    await queryInterface.createTable('cpus', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      name: STRING(30),
      brand: STRING(30),
      created_at: DATE,
      updated_at: DATE,
    });
  },

  down: async queryInterface => {
    await queryInterface.dropTable('cpus');
  },
};
