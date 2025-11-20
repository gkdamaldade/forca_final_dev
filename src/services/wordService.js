const { models, sequelize } = require('../models');

/**
 * Mapeamento das categorias do frontend para as categorias no banco de dados
 */
const mapeamentoCategorias = {
  'alimentos': 'alimento',
  'profissoes': 'profissao',
  'profissões': 'profissao',
  'animais': 'animais',
  'esportes': 'esportes',
  'paises': 'paises',
  'países': 'paises'
};

/**
 * Normaliza a categoria para corresponder ao formato do banco
 * Remove acentos, converte para minúsculas e mapeia para os nomes do banco
 */
function normalizarCategoria(categoria) {
  if (!categoria) return null;
  
  // Remove acentos, converte para minúsculas e remove espaços extras
  let normalizada = categoria
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  
  // Aplica o mapeamento se existir
  if (mapeamentoCategorias[normalizada]) {
    normalizada = mapeamentoCategorias[normalizada];
  }
  
  return normalizada;
}

/**
 * Busca uma palavra aleatória da tabela "palavra",
 * filtrando pela categoria vinda do front-end.
 */
async function getRandomWord({ categoria }) {

  const where = {};

  // Se veio categoria do input, filtra (usando busca case-insensitive)
  if (categoria) {
    const categoriaNormalizada = normalizarCategoria(categoria);
    // Usa Op.iLike para busca case-insensitive no PostgreSQL (equivalente a ILIKE)
    const { Op } = require('sequelize');
    where.categoria = {
      [Op.iLike]: categoriaNormalizada
    };
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
