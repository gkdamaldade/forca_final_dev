// src/db/sequelize.js (Este é o arquivo que você deve alterar)

const { Sequelize } = require('sequelize');
require('dotenv').config(); // Carrega o .env

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
  
  // --- ADICIONE ISTO PARA O SUPABASE ---
  // O Supabase (e qualquer banco na nuvem) exige SSL
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false // (Necessário para a maioria das conexões)
    }}
  // ------------------------------------
});

module.exports = { sequelize };