'use strict';

module.exports = app => {
  const { STRING, ENUM, DATE, NOW } = app.Sequelize;

  const Admin = app.model.define('admin', {
    username: {
      type: STRING(100),
      unique: true,
      allowNull: false,
      validate: {
        is: /^[a-zA-Z]{1}([a-zA-Z0-9]|[._]){1,50}$/i,
        isLowercase: true,
      },
    },
    password: {
      type: STRING(32),
      allowNull: true,
    },
    created_at: {
      type: DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: NOW,
    },
    updated_at: {
      type: DATE,
      field: 'updated_at',
      allowNull: false,
      defaultValue: NOW,
    },
  }, {
    timestamps: false,
    tableName: 'admins',
    underscored: false,
  });

  return Admin;
};
