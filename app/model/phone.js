'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE } = app.Sequelize;

  const Phone = app.model.define('phone', {
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
    desc: STRING(700),
    createdAt: DATE,
    updatedAt: DATE,
    del: INTEGER,
    rearCamera: STRING(5),
    nowPrice: INTEGER,
    cpu: STRING(30),
    rearMax: INTEGER,
    frontMax: INTEGER,
    cg: INTEGER, // communication generation
    rec: INTEGER,
    iid: STRING(15),
    key: STRING(15),
  });

  return Phone;
};
