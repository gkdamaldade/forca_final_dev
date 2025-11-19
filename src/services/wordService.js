const { models, sequelize } = require('../models');

/**
 * Busca uma palavra aleatória da tabela "palavra",
 * filtrando pela categoria vinda do front-end.
 */
async function getRandomWord({ categoria }) {

  const where = {};

  // Se veio categoria do input, filtra
  if (categoria) {
    where.categoria = categoria;
  }

  // Busca palavra aleatória
  const palavra = await models.Word.findOne({
    where,
    order: [sequelize.random()] // ORDER BY RANDOM()
  });

  if (!palavra) {
    throw new Error(`Nenhuma palavra encontrada para a categoria: ${categoria}`);
  }

  return palavra;
}

module.exports = { getRandomWord };
