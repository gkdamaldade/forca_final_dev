// controllers/gameController.js
const { getNovaPalavra } = require('../services.js');
const { Game } = require('../game.js');
const { models } = require('../models').default;

// Variável global para manter o jogo atual (por enquanto)
let jogoAtual = null;

function iniciarNovoJogo() {
    console.log("Controller: Criando novo jogo...");
    const { palavra, categoria } = getNovaPalavra();
    jogoAtual = new Game(palavra, categoria);
    return jogoAtual.getEstado();
}


// Certifique-se de que este controller tenha:
// const { models } = require('../models'); // ajuste o caminho conforme sua estrutura
async function lidarComChute(letra) {
  // Processa o chute no jogo em memória
  jogoAtual.chutarLetra(letra);

  // Se a partida terminou, persiste no banco
  if (jogoAtual.status === "vitoria" || jogoAtual.status === "derrota") {
    try {
      await models.Partida.create({
        palavra: jogoAtual.palavraSecreta,
        categoria: jogoAtual.categoria,
        status: jogoAtual.status,
        erros: jogoAtual.erros,
        vencedor: jogoAtual.status === "vitoria" ? jogoAtual.turn : null
      });
    } catch (err) {
      console.error("Erro ao salvar Partida no banco:", err);
      // opcional: lançar o erro para ser tratado por middleware
      // throw err;
    }
  }

  // Retorna o estado atualizado
  return jogoAtual.getEstado();
}

// function lidarComChute(letra) {
    

//     jogoAtual.chutarLetra(letra);
//     return jogoAtual.getEstado();
// }

function lidarComTempoEsgotado() {
    if (!jogoAtual || jogoAtual.status !== "jogando") {
        throw new Error("Jogo não iniciado.");
    }
    console.log("Tempo esgotado! Trocando turno...");
    jogoAtual.trocarTurno();
    return jogoAtual.getEstado();
}

function lidarComPoder(poderId, jogadorQueUsou) {
    if (!jogoAtual || jogoAtual.status !== 'jogando') {
        throw new Error("Não há jogo em andamento.");
    }

    console.log(`Controller: Jogador ${jogadorQueUsou} usou o poder '${poderId}'`);

    switch (poderId) {
        case 'mago-negro':
            const novoEstado = jogoAtual.revelarLetraMaisRepetida();
            return { tipo: 'gameState', estado: novoEstado };
        case 'etanol':
            if (Math.random() < 0.5) {
                return { tipo: 'ataqueVida', sucesso: true, alvo: (jogadorQueUsou === 1 ? 2 : 1) };
            } else {
                return { tipo: 'ataqueVida', sucesso: false };
            }
        case 'ocultar-dica':
            const oponente = (jogadorQueUsou === 1 ? 2 : 1);
            jogoAtual.ocultarDica(oponente);
            return { tipo: 'ocultarDica', sucesso: true, alvo: oponente, estado: jogoAtual.getEstado() };
        case 'ocultar-letra':
            const caractereDeletado = jogoAtual.removerCaractereAleatorio();
            return { tipo: 'ocultarLetra', sucesso: true, caractere: caractereDeletado, estado: jogoAtual.getEstado() };
        case 'roleta-russa':
            const azar = Math.random() < 0.5;
            if (azar) {
                return { tipo: 'ataqueVida', sucesso: true, alvo: jogadorQueUsou };
            } else {
                const estadoAtualizado = jogoAtual.ocultarUltimaLetraRevelada();
                return { tipo: 'ocultarLetraOponente', sucesso: true, estado: estadoAtualizado };
            }
        default:
            throw new Error("Poder desconhecido.");
    }
}

module.exports = { 
    iniciarNovoJogo,
    lidarComChute,
    lidarComTempoEsgotado,
    lidarComPoder
};
