const { getNovaPalavra } = require('./services.js');
const { Game } = require('./game.js');

// VARIÁVEL PARA GUARDAR O JOGO ATUAL (APENAS PARA TESTE)
// Em produção, você guardaria isso no banco de dados
let jogoAtual = null;

function iniciarNovoJogo() {
    console.log("Controller: Criando novo jogo...");
    const { palavra, categoria } = getNovaPalavra();
    
    // Salva o novo jogo na nossa variável
    jogoAtual = new Game(palavra, categoria);
    
    return jogoAtual.getEstado();
}

// --- NOVA FUNÇÃO ---
/**
 * Recebe um chute, processa no jogo atual, e retorna o novo estado.
 */
function lidarComChute(letra) {
    if (!jogoAtual || jogoAtual.status !== "jogando") {
        throw new Error("Não há jogo em andamento ou o jogo já acabou.");
    }

    console.log(`Controller: Processando chute '${letra}'`);
    
    // Usa o método da classe Game para processar o chute
    jogoAtual.chutarLetra(letra);

    // Retorna o estado ATUALIZADO do jogo
    return jogoAtual.getEstado();
}


module.exports = { 
    iniciarNovoJogo,
    lidarComChute // Exporte a nova função
};