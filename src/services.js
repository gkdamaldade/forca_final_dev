// src/services.js

const { models } = require('./models');
const { Op } = require("sequelize");

async function getNovaPalavra() {

    // 1. Buscar uma palavra aleatória que ainda não foi usada
    const palavra = await models.Palavra.findOne({
        where: { usada: false },
        order: [models.sequelize.random()] // ORDER BY RANDOM()
    });

    if (!palavra) {
        throw new Error("Não há mais palavras disponíveis no banco.");
    }

    // 2. Marcar como usada (opcional)
    await palavra.update({ usada: true });

    // 3. Retornar no formato que o Game espera
    return {
        palavra: palavra.palavra,
        categoria: palavra.categoria
    };
}

module.exports = { getNovaPalavra };
