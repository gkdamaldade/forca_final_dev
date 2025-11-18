// routes/games.js
const express = require('express');
const router = express.Router();

const gameController = require('../controllers/gameController');
const auth = require('../middleware/auth');

// Iniciar nova partida (frontend chama GET /api/novo-jogo)
router.get('/novo-jogo', async (req, res, next) => {
  try {
    const { player1Id, player2Id } = req.query; // pode vir via query string
    const estadoDoJogo = await gameController.iniciarNovoJogo(player1Id, player2Id);
    res.status(200).json(estadoDoJogo);
  } catch (error) {
    console.error("Erro em GET /novo-jogo:", error.message);
    next(error);
  }
});

// Jogar (frontend chama POST /api/chutar)
router.post('/chutar', auth, async (req, res, next) => {
  try {
    const { letra } = req.body;
    const rodada = await gameController.lidarComChute(letra);
    res.json(rodada);
  } catch (err) {
    next(err);
  }
});

// Usar poder (frontend chama POST /api/usar-poder)
router.post('/usar-poder', auth, async (req, res, next) => {
  try {
    const { poderId, jogador } = req.body;
    const resultado = await gameController.lidarComPoder(poderId, jogador);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
