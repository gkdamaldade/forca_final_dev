// src/db/sequelize.js
const { Sequelize } = require('sequelize');
require('.env').config();

const {
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASS,
  DB_DIALECT
} = process.env;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: DB_DIALECT,

  // 🔥 Supabase + pgBouncer
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
    keepAlive: true
  },

  // 🔥 Importante! pgBouncer NÃO aceita muitos connections
  pool: {
    max: 1,
    min: 0,
    idle: 10000
  },

  logging: false
});

module.exports = { sequelize };
