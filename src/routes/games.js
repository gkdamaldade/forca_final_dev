const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const auth = require('../middleware/auth');

// Criar nova partida
// routes/games.js
router.post('/novo-jogo', (req, res) => {
    try {
        const { player1Id, player2Id } = req.body; // IDs enviados pelo cliente
        const estadoDoJogo = iniciarNovoJogo({ player1Id, player2Id });
        res.status(201).json(estadoDoJogo); // 201 Created
    } catch (error) {
        console.error("Erro em POST /novo-jogo:", error.message);
        res.status(500).json({ message: error.message });
    }
});


// Jogar (chute de letra)
router.post('/play', auth, async (req, res, next) => {
  try {
    const rodada = await gameController.lidarComChute(req.body.letra);
    res.json(rodada);
  } catch (err) { next(err); }
});

// Tempo esgotado
router.post('/timeout', auth, async (req, res, next) => {
  try {
    const estado = await gameController.lidarComTempoEsgotado();
    res.json(estado);
  } catch (err) { next(err); }
});

// Usar poder
router.post('/power', auth, async (req, res, next) => {
  try {
    const { poderId, jogadorQueUsou } = req.body;
    const resultado = await gameController.lidarComPoder(poderId, jogadorQueUsou);
    res.json(resultado);
  } catch (err) { next(err); }
});

module.exports = router;
