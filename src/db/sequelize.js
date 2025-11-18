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

// const { Sequelize } = require('sequelize');

// const sequelize = new Sequelize(
//   process.env.DB_NAME,
//   process.env.DB_USER,
//   process.env.DB_PASS,
//   {
//     host: process.env.DB_HOST,
//     port: process.env.DB_PORT, // usa o 6543 do .env
//     dialect: 'postgres',
//     dialectOptions: {
//       ssl: {
//         require: true,
//         rejectUnauthorized: false
//       }
//     },
//     pool: {
//       max: 3,  // obrigatório para pgBouncer
//       min: 0,
//       acquire: 30000,
//       idle: 10000
//     }
//   }
// );

// module.exports = { sequelize };
