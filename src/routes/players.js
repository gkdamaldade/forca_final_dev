const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');

// Cadastro
router.post('/register', async (req, res, next) => {
  try {
    const novoPlayer = await playerController.lidarCadastro(req.body);
    res.status(201).json(novoPlayer);
  } catch (err) { next(err); }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const loginData = await playerController.lidarLogin(req.body);
    res.json(loginData);
  } catch (err) { next(err); }
});

// Ranking
router.get('/ranking', async (req, res, next) => {
  try {
    const ranking = await playerController.listarRanking();
    res.json(ranking);
  } catch (err) { next(err); }
});

// Registrar vitória
router.post('/victory', async (req, res, next) => {
  try {
    const resultado = await playerController.registrarVitoria(req.body);
    res.json(resultado);
  } catch (err) { next(err); }
});

module.exports = router;
