const { getRandomWord } = require('./services/wordService.js');

async function iniciarNovoJogo(categoriaEscolhida) {
    const palavraDB = await getRandomWord({ categoria: categoriaEscolhida });

    const palavra = palavraDB.palavra;
    const categoria = palavraDB.categoria;

    jogoAtual = new Game(palavra, categoria);

    return jogoAtual.getEstado();
}
