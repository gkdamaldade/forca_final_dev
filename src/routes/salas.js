const express = require('express');
const router = express.Router(); // exporte Sala no seu models/index.js
const { models } = require('../models');
const Sala = models.Sala;

function gerarCodigo(n = 6) {
  // removendo O/0 e I/1 para evitar ambiguidade
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

// POST /api/salas { categoria: string }  --> cria sala com código único
router.post('/salas', async (req, res) => {
  try {
    const { categoria } = req.body ?? {};
    if (!categoria) return res.status(400).json({ message: 'Categoria é obrigatória.' });

    for (let tent = 0; tent < 5; tent++) {
      try {
        const sala = await Sala.create({
          codigo: gerarCodigo(),
          categoria,
          // host_user_id: req.user?.id  // quando você ativar JWT no backend
        });
        return res.status(201).json({ sala: sala.codigo, categoria: sala.categoria });
      } catch (e) {
        if (e?.name === 'SequelizeUniqueConstraintError') continue; // colisão, tenta novo código
        console.error(e);
        return res.status(500).json({ message: 'Erro interno' });
      }
    }
    return res.status(503).json({ message: 'Falha ao gerar código único. Tente novamente.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Erro interno' });
  }
});

// GET /api/salas/:codigo  --> consulta sala
router.get('/salas/:codigo', async (req, res) => {
  const codigo = (req.params.codigo || '').toUpperCase();
  console.log("Esse é o codigo:", codigo);
  const sala = await Sala.findOne({ where: { codigo } });
  console.log("A sala é:", sala);
  if (!sala) return res.status(404).json({ message: 'Sala não encontrada.' });
  return res.json({ sala: sala.codigo, categoria: sala.categoria, status: sala.status });
});


module.exports = router;
