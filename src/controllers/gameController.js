// controllers/gameController.js
const { getNovaPalavra } = require('../services.js');
const { Game } = require('../game.js');
const { models } = require('../models');

// Variável global para manter o jogo atual (por enquanto)
let jogoAtual = null;

function iniciarNovoJogo(player1Id, player2Id) {
    console.log("Controller: Criando novo jogo...");
    const { palavra, categoria } = getNovaPalavra();
    jogoAtual = new Game(palavra, categoria, player1Id, player2Id); // se o construtor aceitar
    try {
        await models.GameM.create({
            word: palavra,
            player1_id: player1Id,
            player2_id: player2Id,    
            turno_atual: 1,
            estado: jogoAtual.getEstado(),
            status_final: null,
            vencedor_id: null
        });
    } catch (err) {
        console.error("Erro ao salvar novo jogo no banco:", err);
    }

    return jogoAtual.getEstado();
}



// Certifique-se de que este controller tenha:
// const { models } = require('../models'); // ajuste o caminho conforme sua estrutura
async function lidarComChute(letra) {
    jogoAtual.chutarLetra(letra);

    if (jogoAtual.status === "vitoria" || jogoAtual.status === "derrota") {
        try {
            await models.GameM.update({
                estado: jogoAtual.getEstado(),
                status_final: jogoAtual.status,
                vencedor_id: jogoAtual.status === "vitoria" ? jogoAtual.turn : null
            }, {
                where: { word: jogoAtual.palavraSecreta }
            });
        } catch (err) {
            console.error("Erro ao atualizar GameM no banco:", err);
        }
    }

    return jogoAtual.getEstado();
}

// function lidarComChute(letra) {
    

//     jogoAtual.chutarLetra(letra);
//     return jogoAtual.getEstado();
// }

async function lidarComTempoEsgotado() {
    if (!jogoAtual || jogoAtual.status !== "jogando") {
        throw new Error("Jogo não iniciado.");
    }
    jogoAtual.trocarTurno();

    try {
        await models.GameM.update({
            turno_atual: jogoAtual.turn,
            estado: jogoAtual.getEstado()
        }, {
            where: { word: jogoAtual.palavraSecreta }
        });
    } catch (err) {
        console.error("Erro ao atualizar turno no banco:", err);
    }

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
