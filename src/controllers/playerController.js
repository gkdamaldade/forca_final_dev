// controllers/playerController.js
const { models } = require('../models').default;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function lidarCadastro(dados) {
    const { username, email, password } = dados; 
    if (!username || !email || !password) {
        throw new Error("Dados de cadastro incompletos.");
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const novoPlayer = await models.Player.create({
        nome: username, 
        email: email,
        senha_hash: hashedPassword
    });
    return {
        id: novoPlayer.id,
        username: novoPlayer.name,
        email: novoPlayer.email
    };
}

async function lidarLogin(dados) {
    const { email, password } = dados;
    if (!email || !password) {
        throw new Error("Email e senha são obrigatórios.");
    }
    const player = await models.Player.findOne({ where: { email: email } });
    if (!player) throw new Error("Credenciais inválidas."); 
    const match = await bcrypt.compare(password, player.senha_hash);
    if (!match) throw new Error("Credenciais inválidas.");
    const payload = { id: player.id, nome: player.nome };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
    return { user: payload, token };
}

async function listarRanking() {
    const ranking = await models.Player.findAll({
        attributes: ['nome', 'vitorias'],
        order: [['vitorias', 'DESC']],
        limit: 10
    });
    return ranking;
}

async function registrarVitoria(dados) {
    const { email } = dados;
    if (!email) throw new Error("Email necessário para registrar vitória.");
    const player = await models.Player.findOne({ where: { email: email } });
    if (player) {
        await player.increment('vitorias');
        return { mensagem: "Vitória registrada!", novasVitorias: player.vitorias + 1 };
    } else {
        throw new Error("Jogador não encontrado.");
    }
}

module.exports = { 
    lidarCadastro,
    lidarLogin,
    listarRanking,
    registrarVitoria
};
