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
 * @param {Object} options - Opções para busca
 * @param {string} options.categoria - Categoria para filtrar
 * @param {Array<string>} options.excluirPalavras - Array de palavras (em maiúsculas) para excluir da busca
 * @param {string} options.dificuldade - Dificuldade para filtrar (opcional)
 */
async function getRandomWord({ categoria, excluirPalavras = [], dificuldade = null }) {
  const { Op } = require('sequelize');
  const where = {};

  // Se veio categoria do input, filtra (usando busca case-insensitive)
  if (categoria) {
    const categoriaNormalizada = normalizarCategoria(categoria);
    where.categoria = {
      [Op.iLike]: categoriaNormalizada
    };
  }

  // Se veio dificuldade, filtra por dificuldade
  if (dificuldade) {
    where.dificuldade = {
      [Op.iLike]: dificuldade
    };
  }

  // Exclui palavras já usadas (busca case-insensitive)
  if (excluirPalavras && excluirPalavras.length > 0) {
    // Converte todas as palavras de exclusão para maiúsculas para comparação
    const palavrasParaExcluir = excluirPalavras.map(p => p.toUpperCase());
    where.palavra = {
      [Op.notIn]: palavrasParaExcluir
    };
  }

  // Busca palavra aleatória com suas dicas (ordem 1, 2, 3)
  // Otimização: usa subquery para melhor performance
  const palavra = await models.Word.findOne({
    where,
    include: [{
      model: models.Dica,
      as: 'dicas',
      where: {
        ordem: {
          [Op.in]: [1, 2, 3] // Apenas as primeiras 3 dicas
        }
      },
      required: false, // LEFT JOIN - retorna palavra mesmo sem dicas
      order: [['ordem', 'ASC']],
      attributes: ['id', 'texto_dica', 'ordem'] // Seleciona apenas campos necessários
    }],
    attributes: ['id', 'palavra', 'categoria', 'dificuldade', 'usada'], // Seleciona apenas campos necessários
    order: [sequelize.literal('RANDOM()')] // ORDER BY RANDOM() para PostgreSQL
  });

  if (!palavra) {
    const mensagem = categoria 
      ? `Nenhuma palavra encontrada para a categoria: ${categoria}${dificuldade ? ` com dificuldade: ${dificuldade}` : ''}${excluirPalavras.length > 0 ? ` (excluindo ${excluirPalavras.length} palavras já usadas)` : ''}`
      : `Nenhuma palavra encontrada no banco de dados${dificuldade ? ` com dificuldade: ${dificuldade}` : ''}${excluirPalavras.length > 0 ? ` (excluindo ${excluirPalavras.length} palavras já usadas)` : ''}`;
    throw new Error(mensagem);
  }

  // Organiza as dicas por ordem
  const dicas = palavra.dicas ? palavra.dicas
    .sort((a, b) => a.ordem - b.ordem)
    .map(d => ({
      id: d.id,
      texto: d.texto_dica,
      ordem: d.ordem
    })) : [];

  // Adiciona as dicas ao objeto retornado
  palavra.dicas = dicas;

  return palavra;
}

module.exports = { getRandomWord };
