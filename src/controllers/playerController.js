// controllers/playerController.js
const { models } = require('../models');
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
        // alterado aqui
        username: novoPlayer.nome,
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

async function obterMoedasUsuario(userId) {
    if (!userId) throw new Error("ID do usuário necessário.");
    const player = await models.Player.findByPk(userId);
    if (!player) throw new Error("Jogador não encontrado.");
    return { moedas: player.moedas || 0 };
}

async function adicionarMoedas(userId, quantidade) {
    if (!userId) throw new Error("ID do usuário necessário.");
    if (!quantidade || quantidade <= 0) throw new Error("Quantidade de moedas inválida.");
    
    const player = await models.Player.findByPk(userId);
    if (!player) throw new Error("Jogador não encontrado.");
    
    const moedasAtuais = player.moedas || 0;
    const novoSaldo = moedasAtuais + quantidade;
    
    await player.update({ moedas: novoSaldo });
    
    return { 
        mensagem: "Moedas adicionadas com sucesso!", 
        moedasAnteriores: moedasAtuais,
        moedasAdicionadas: quantidade,
        novoSaldo: novoSaldo 
    };
}

module.exports = { 
    lidarCadastro,
    lidarLogin,
    listarRanking,
    registrarVitoria,
    obterMoedasUsuario,
    adicionarMoedas
};
