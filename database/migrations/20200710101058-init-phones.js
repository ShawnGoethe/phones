'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { INTEGER, DATE, STRING } = Sequelize;
    await queryInterface.createTable('phones', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      name: STRING(30),
      brand: STRING(30),
      price: INTEGER,
      inch: INTEGER,
      battery: INTEGER,
      nfc: Boolean,
      headphonePlug: STRING(30),
      charging: INTEGER,
      os: STRING(30),
      dualSpeaker: INTEGER,
      frontCamera: STRING(30),
      cpu: STRING(30),
      rearMax: INTEGER,
      frontMax: INTEGER,
      cg: INTEGER, // communication generation
      rec: INTEGER,
      created_at: DATE,
      updated_at: DATE,
    });
  },

  down: async queryInterface => {
    await queryInterface.dropTable('users');
  },
};
