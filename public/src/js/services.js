const listaDePalavras = [
    { palavra: "JAVASCRIPT", categoria: "PROGRAMAÇÃO" },
    { palavra: "BACKEND", categoria: "PROGRAMAÇÃO" },
    { palavra: "SEQUELIZE", categoria: "BANCO DE DADOS" },
    { palavra: "FORCA", categoria: "JOGOS" }
];

function getNovaPalavra() {
    console.log("Serviço: Fornecendo uma nova palavra (mock)...");
    const indiceAleatorio = Math.floor(Math.random() * listaDePalavras.length);
    return listaDePalavras[indiceAleatorio];
}

module.exports = { getNovaPalavra };