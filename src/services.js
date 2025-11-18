// src/services.js

const listaDePalavras = [
    { palavra: "JAVASCRIPT", categoria: "PROGRAMAÇÃO" },
    { palavra: "BACKEND", categoria: "PROGRAMAÇÃO" },
    { palavra: "SEQUELIZE", categoria: "BANCO DE DADOS" },
    { palavra: "FORCA", categoria: "JOGOS" }
];

/**
 * Pega uma palavra aleatória da nossa lista.
 */
function getNovaPalavra() {
    console.log("Serviço: Fornecendo uma nova palavra (mock)...");
    const indiceAleatorio = Math.floor(Math.random() * listaDePalavras.length);
    return listaDePalavras[indiceAleatorio];
}

// Use CommonJS (module.exports)
module.exports = { getNovaPalavra };