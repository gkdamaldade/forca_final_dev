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

async function listarItensLoja() {
    const itens = await models.ItemLoja.findAll({
        where: { ativo: true },
        order: [['custo_moedas', 'ASC']]
    });
    return itens;
}

async function comprarPoder(userId, itemlojaId) {
    if (!userId) throw new Error("ID do usuário necessário.");
    if (!itemlojaId) throw new Error("ID do item da loja necessário.");
    
    const player = await models.Player.findByPk(userId);
    if (!player) throw new Error("Jogador não encontrado.");
    
    // Busca o item na loja
    const itemLoja = await models.ItemLoja.findByPk(itemlojaId);
    if (!itemLoja) throw new Error("Item não encontrado na loja.");
    if (!itemLoja.ativo) throw new Error("Este item não está mais disponível.");
    
    const moedasAtuais = player.moedas || 0;
    const preco = itemLoja.custo_moedas;
    
    // Verifica se o usuário tem moedas suficientes
    if (moedasAtuais < preco) {
        throw new Error("Moedas insuficientes para comprar este poder.");
    }
    
    // Deduz as moedas do usuário
    const novoSaldo = moedasAtuais - preco;
    await player.update({ moedas: novoSaldo });
    
    // Adiciona ou atualiza o poder no inventário
    const [inventarioItem, created] = await models.Inventario.findOrCreate({
        where: {
            usuario_id: userId,
            itemloja_id: itemlojaId
        },
        defaults: {
            usuario_id: userId,
            itemloja_id: itemlojaId,
            quantidade: 1
        }
    });
    
    // Se o poder já existia, incrementa a quantidade
    if (!created) {
        await inventarioItem.increment('quantidade');
        await inventarioItem.reload();
    }
    
    return {
        mensagem: "Poder comprado com sucesso!",
        itemLoja: {
            id: itemLoja.id,
            nome: itemLoja.nome,
            tipo_poder: itemLoja.tipo_poder
        },
        moedasGastas: preco,
        moedasAnteriores: moedasAtuais,
        novoSaldo: novoSaldo,
        quantidade: inventarioItem.quantidade
    };
}

async function obterInventario(userId) {
    if (!userId) throw new Error("ID do usuário necessário.");
    
    const inventario = await models.Inventario.findAll({
        where: { usuario_id: userId },
        include: [{
            model: models.ItemLoja,
            as: 'itemLoja',
            attributes: ['id', 'nome', 'descricao', 'tipo_poder', 'imagem']
        }],
        attributes: ['id', 'quantidade', 'itemloja_id']
    });
    
    return inventario.map(item => ({
        id: item.id,
        itemloja_id: item.itemloja_id,
        quantidade: item.quantidade,
        tipo_poder: item.itemLoja?.tipo_poder,
        nome: item.itemLoja?.nome,
        descricao: item.itemLoja?.descricao,
        imagem: item.itemLoja?.imagem
    }));
}

async function usarPoderInventario(userId, tipoPoder) {
    if (!userId) throw new Error("ID do usuário necessário.");
    if (!tipoPoder) throw new Error("Tipo de poder necessário.");
    
    // Busca o item na loja pelo tipo_poder
    const itemLoja = await models.ItemLoja.findOne({
        where: { tipo_poder: tipoPoder, ativo: true }
    });
    
    if (!itemLoja) {
        throw new Error("Poder não encontrado na loja.");
    }
    
    // Busca o item no inventário do usuário
    const inventarioItem = await models.Inventario.findOne({
        where: {
            usuario_id: userId,
            itemloja_id: itemLoja.id
        }
    });
    
    if (!inventarioItem || inventarioItem.quantidade <= 0) {
        throw new Error("Você não possui este poder no inventário.");
    }
    
    // Subtrai 1 da quantidade
    const novaQuantidade = inventarioItem.quantidade - 1;
    
    if (novaQuantidade <= 0) {
        // Remove do inventário se a quantidade chegar a 0
        await inventarioItem.destroy();
    } else {
        // Atualiza a quantidade
        await inventarioItem.update({ quantidade: novaQuantidade });
    }
    
    return {
        mensagem: "Poder usado com sucesso!",
        tipo_poder: tipoPoder,
        quantidadeRestante: novaQuantidade
    };
}

module.exports = { 
    lidarCadastro,
    lidarLogin,
    listarRanking,
    registrarVitoria,
    obterMoedasUsuario,
    adicionarMoedas,
    listarItensLoja,
    comprarPoder,
    obterInventario,
    usarPoderInventario
};
