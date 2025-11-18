const express = require('express');
const router = express.Router();

// 1. Importa a nova função
const { iniciarNovoJogo, lidarComChute, lidarComPoder,lidarCadastro, lidarLogin, listarRanking, registrarVitoria, lidarComTempoEsgotado } = require('../controller.js'); 

/* --- ROTA PARA INICIAR O JOGO --- */
router.get('/novo-jogo', (req, res) => {
    try {
        const estadoDoJogo = iniciarNovoJogo();
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

router.post('/cadastro', async (req, res) => {
    try {
        // req.body vai conter { username, email, password }
        const novoJogador = await lidarCadastro(req.body);
        
        // 201 Created - O padrão para criação bem-sucedida
        res.status(201).json(novoJogador); 

    } catch (error) {
        console.error("Erro em POST /cadastro:", error.message);
        
        // Checa se é um erro de "usuário já existe"
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: "Email ou usuário já cadastrado." });
        }

        res.status(500).json({ message: "Erro interno ao cadastrar." });
    }
});


router.post('/login', async (req, res) => {
    try {
        // req.body vai conter { email, password }
        const loginData = await lidarLogin(req.body);
        
        // Retorna 200 OK com o token
        res.status(200).json(loginData); 

    } catch (error) {
        console.error("Erro em POST /login:", error.message);
        
        // Se for "Credenciais inválidas", retorna 401 (Não Autorizado)
        if (error.message === "Credenciais inválidas.") {
            return res.status(401).json({ message: error.message });
        }

        res.status(500).json({ message: "Erro interno ao fazer login." });
    }
});

router.post('/registrar-vitoria', async (req, res) => {
    try {
        const resultado = await registrarVitoria(req.body);
        res.status(200).json(resultado);
    } catch (error) {
        console.error("Erro ao registrar vitória:", error.message);
        res.status(500).json({ message: "Erro ao salvar vitória." });
    }
});

router.get('/ranking', async (req, res) => {
    try {
        const ranking = await listarRanking();
        res.status(200).json(ranking);
    } catch (error) {
        // ...
    }
});

router.post('/tempo-esgotado', (req, res) => {
    try {
        const novoEstado = lidarComTempoEsgotado();
        res.status(200).json(novoEstado);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


module.exports = router;
