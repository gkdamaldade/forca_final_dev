
const { Op } = require('sequelize');
const { models } = require('../models');

function computePoints({ won, errors }) {
  if (!won) return 0;
  return Math.max(10, 100 - (errors || 0) * 10);
}

async function findOrCreatePlayer({ name, email }) {
  if (email) {
    const [player] = await models.Player.findOrCreate({ where: { email }, defaults: { name } });
    if (name && player.name !== name) await player.update({ name });
    return player;
  }
  return models.Player.create({ name });
}

async function registerResult({ playerName, playerEmail, wordId, won, attempts = 0, errors = 0, durationMs = null }) {
  const player = await findOrCreatePlayer({ name: playerName, email: playerEmail });
  const points = computePoints({ won, errors });

  const result = await models.Result.create({
    player_id: player.id,
    word_id: wordId,
    won,
    attempts,
    errors,
    points,
    duration_ms: durationMs
  });

  return { result, player };
}

async function getLeaderboard({ limit = 10, period = 'all' }) {
  let where = {};
  if (period === 'week' || period === 'month') {
    const days = period === 'week' ? 7 : 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    where = { created_at: { [Op.gte]: start } };
  }

  const rows = await models.Result.findAll({
    attributes: [
      'player_id',
      [models.Result.sequelize.fn('SUM', models.Result.sequelize.col('points')), 'totalPoints'],
      [models.Result.sequelize.fn('COUNT', models.Result.sequelize.col('id')), 'games'],
      [models.Result.sequelize.fn('SUM', models.Result.sequelize.literal('CASE WHEN won THEN 1 ELSE 0 END')), 'wins']
    ],
    where,
    include: [{ model: models.Player, as: 'player', attributes: ['id', 'name', 'email'] }],
    group: ['player_id', 'player.id', 'player.name', 'player.email'],
    order: [[models.Result.sequelize.literal('totalPoints'), 'DESC']],
    limit
  });

  return rows;
}

module.exports = { registerResult, getLeaderboard, computePoints };
