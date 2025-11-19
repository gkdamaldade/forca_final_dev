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
    order: [sequelize.literal('RANDOM()')] // ORDER BY RANDOM() para PostgreSQL
  });

  if (!palavra) {
    const mensagem = categoria 
      ? `Nenhuma palavra encontrada para a categoria: ${categoria}`
      : 'Nenhuma palavra encontrada no banco de dados';
    throw new Error(mensagem);
  }

  return palavra;
}

module.exports = { getRandomWord };
