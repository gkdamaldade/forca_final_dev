
const { registerResult, getLeaderboard } = require('../services/resultService');

async function create(req, res, next) {
  try {
    const { playerName, playerEmail, wordId, won, attempts, errors, durationMs } = req.body;
    if (!playerName && !playerEmail) return res.status(400).json({ message: 'Informe playerName ou playerEmail.' });
    if (!wordId) return res.status(400).json({ message: 'wordId é obrigatório.' });
    if (typeof won !== 'boolean') return res.status(400).json({ message: 'won deve ser boolean.' });

    const { result, player } = await registerResult({ playerName, playerEmail, wordId, won, attempts, errors, durationMs });
    res.status(201).json({ result, player });
  } catch (err) { next(err); }
}

async function leaderboard(req, res, next) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const period = req.query.period || 'all';
    const data = await getLeaderboard({ limit, period });
    res.json(data);
  } catch (err) { next(err); }
}

module.exports = { create, leaderboard };
