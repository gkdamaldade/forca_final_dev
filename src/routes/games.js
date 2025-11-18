// routes/games.js
const express = require('express');
const router = express.Router();

const gameController = require('../controllers/gameController');
const auth = require('../middleware/auth');

// Criar nova partida
router.post('/novo-jogo', async (req, res, next) => {
  try {
    const { player1Id, player2Id } = req.body;
    const estadoDoJogo = await gameController.iniciarNovoJogo(player1Id, player2Id);
    res.status(201).json(estadoDoJogo);
  } catch (error) {
    console.error("Erro em POST /novo-jogo:", error.message);
    next(error);
  }
});

// Jogar (chute de letra)
router.post('/play', auth, async (req, res, next) => {
  try {
    const { letra } = req.body;
    const rodada = await gameController.lidarComChute(letra);
    res.json(rodada);
  } catch (err) {
    next(err);
  }
});

// Tempo esgotado
router.post('/timeout', auth, async (req, res, next) => {
  try {
    const estado = await gameController.lidarComTempoEsgotado();
    res.json(estado);
  } catch (err) {
    next(err);
  }
});

// Usar poder
router.post('/power', auth, async (req, res, next) => {
  try {
    const { poderId, jogadorQueUsou } = req.body;
    const resultado = await gameController.lidarComPoder(poderId, jogadorQueUsou);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
