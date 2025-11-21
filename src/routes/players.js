const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');
const jwt = require('jsonwebtoken');

// Middleware simples para verificar token JWT
function verificarToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-access-token'];
  
  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Adiciona os dados do usuário decodificados ao request
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
}

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

// Obter moedas do usuário (requer autenticação)
router.get('/moedas', verificarToken, async (req, res, next) => {
  try {
    const resultado = await playerController.obterMoedasUsuario(req.user.id);
    res.json(resultado);
  } catch (err) { next(err); }
});

// Comprar moedas (requer autenticação)
router.post('/comprar-moedas', verificarToken, async (req, res, next) => {
  try {
    const { quantidade } = req.body;
    if (!quantidade || quantidade <= 0) {
      return res.status(400).json({ message: 'Quantidade de moedas inválida.' });
    }
    const resultado = await playerController.adicionarMoedas(req.user.id, quantidade);
    res.json(resultado);
  } catch (err) { next(err); }
});

// Listar itens da loja (público)
router.get('/loja/itens', async (req, res, next) => {
  try {
    const itens = await playerController.listarItensLoja();
    res.json(itens);
  } catch (err) { next(err); }
});

// Comprar poder (requer autenticação)
router.post('/comprar-poder', verificarToken, async (req, res, next) => {
  try {
    const { itemlojaId } = req.body;
    if (!itemlojaId) {
      return res.status(400).json({ message: 'ID do item da loja é obrigatório.' });
    }
    const resultado = await playerController.comprarPoder(req.user.id, itemlojaId);
    res.json(resultado);
  } catch (err) { next(err); }
});

// Obter inventário do usuário (requer autenticação)
router.get('/inventario', verificarToken, async (req, res, next) => {
  try {
    const inventario = await playerController.obterInventario(req.user.id);
    res.json(inventario);
  } catch (err) { next(err); }
});

// Usar poder do inventário (requer autenticação)
router.post('/usar-poder', verificarToken, async (req, res, next) => {
  try {
    const { tipoPoder } = req.body;
    if (!tipoPoder) {
      return res.status(400).json({ message: 'Tipo de poder é obrigatório.' });
    }
    const resultado = await playerController.usarPoderInventario(req.user.id, tipoPoder);
    res.json(resultado);
  } catch (err) { next(err); }
});

module.exports = router;
