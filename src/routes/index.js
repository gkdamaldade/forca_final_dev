const express = require('express');
const router = express.Router();

// 1. Importa a nova função
const { iniciarNovoJogo, lidarComChute, lidarComPoder,lidarCadastro, lidarLogin, listarRanking, registrarVitoria, lidarComTempoEsgotado } = require('../controller.js'); 

/* --- ROTA PARA INICIAR O JOGO --- */
router.get('/novo-jogo', async (req, res) => {
    try {
        // Pega a categoria da query string (ex: /api/novo-jogo?categoria=Animais)
        const categoria = req.query.categoria || null;
        const estadoDoJogo = await iniciarNovoJogo(categoria);
        res.status(200).json(estadoDoJogo);
    } catch (error) {
        console.error("Erro em GET /novo-jogo:", error.message);
        res.status(500).json({ message: error.message });
    }
});

/* --- ROTA PARA CHUTAR LETRA --- */
router.post('/chutar', (req, res) => {
    try {
        const { letra } = req.body; 
        if (!letra) {
            return res.status(400).json({ message: "Nenhuma letra foi enviada." });
        }
        const novoEstadoDoJogo = lidarComChute(letra);
        res.status(200).json(novoEstadoDoJogo);
    } catch (error) {
        console.error("Erro em POST /chutar:", error.message);
        res.status(500).json({ message: error.message });
    }
});

/* --- NOVA ROTA PARA USAR PODER --- */
router.post('/usar-poder', (req, res) => {
    try {
        // O frontend vai nos dizer qual poder e quem usou
        const { poderId, jogador } = req.body; 

        if (!poderId || !jogador) {
            return res.status(400).json({ message: "Dados do poder incompletos." });
        }
        
        // O controller processa o poder e retorna um resultado
        const resultadoDoPoder = lidarComPoder(poderId, jogador);
        
        res.status(200).json(resultadoDoPoder);

    } catch (error) {
        console.error("Erro em POST /usar-poder:", error.message);
        res.status(500).json({ message: error.message });
    }
});
// Retirado funções

router.post('/tempo-esgotado', (req, res) => {
    try {
        const novoEstado = lidarComTempoEsgotado();
        res.status(200).json(novoEstado);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


module.exports = router;
