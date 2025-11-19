// game.js - Versão Socket.io para Jogo Multiplayer

import { conectarSocket, aoReceberEvento, enviarEvento, getMeuSocketId } from './socket.js';

// --- 1. SELETORES DO DOM ---
const categoriaEl = document.querySelector('.categoria');
const timerEl = document.querySelector('.tempo');
const palavraP1_El = document.querySelector('.palavras .palavra:nth-child(1)');
const palavraP2_El = document.querySelector('.palavras .palavra:nth-child(2)');
const tecladoContainer = document.querySelector('.teclado');
const vidasP1Container = document.querySelector('.jogador:nth-child(1) .vidas');
const vidasP2Container = document.querySelector('.jogador:nth-child(2) .vidas');
const bonecoP1_El = document.querySelector('.bonecos .boneco:nth-child(1) img');
const bonecoP2_El = document.querySelector('.bonecos .boneco:nth-child(2) img');
const h2Jogador1 = document.querySelector('.jogador:nth-child(1) h2');
const h2Jogador2 = document.querySelector('.jogador:nth-child(2) h2');

// --- 2. ESTADO DO JOGO ---
let meuNumeroJogador = null; // 1 ou 2
let adversarioNome = '';
let palavraSecreta = '';
let palavraExibida = '';
let turnoAtual = 1;
let erros = 0;
let letrasChutadas = new Set();
let jogoEstaAtivo = false;
let timerInterval = null;
let sala = '';
let categoria = '';

// --- 3. INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    sala = urlParams.get('sala');
    categoria = urlParams.get('categoria') || 'Geral';
    
    if (!sala) {
        console.error('Sala não encontrada na URL');
        categoriaEl.textContent = 'Erro: Sala não encontrada';
        return;
    }

    // Obtém o nome do token
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    const nome = JSON.parse(atob(token.split('.')[1])).nome;
    
    // Conecta ao socket (pode já estar conectado, mas garante a conexão)
    conectarSocket(sala, nome, categoria);
    
    // Aguarda um pouco para garantir que o socket está conectado
    setTimeout(() => {
        // Se o jogo já iniciou (evento 'inicio' já foi recebido), não faz nada
        // Caso contrário, o listener vai receber quando ambos estiverem prontos
    }, 500);
    
    // Configura listeners
    configurarListenersSocket();
    configurarTecladoVirtual();
    document.addEventListener('keydown', lidarComChuteDeTecladoFisico);
});

// --- 4. SOCKET LISTENERS ---
function configurarListenersSocket() {
    aoReceberEvento((evento) => {
        if (evento.tipo === 'inicio') {
            iniciarJogo(evento);
        } else if (evento.tipo === 'jogada') {
            processarJogada(evento);
        } else if (evento.tipo === 'erro') {
            console.warn('Erro do servidor:', evento.mensagem);
        }
    });
}

function iniciarJogo(dados) {
    meuNumeroJogador = dados.jogador;
    adversarioNome = dados.adversario;
    palavraSecreta = dados.palavraSecreta || dados.palavra; // Usa palavraSecreta se disponível
    palavraExibida = dados.palavra; // Palavra oculta para exibição
    turnoAtual = dados.turno;
    categoria = dados.categoria;
    
    // Atualiza nomes dos jogadores
    if (meuNumeroJogador === 1) {
        h2Jogador1.textContent = 'Você';
        h2Jogador2.textContent = adversarioNome;
    } else {
        h2Jogador1.textContent = adversarioNome;
        h2Jogador2.textContent = 'Você';
    }
    
    jogoEstaAtivo = true;
    erros = 0;
    letrasChutadas.clear();
    
    categoriaEl.textContent = categoria;
    atualizarPalavraExibida();
    atualizarBonecosUI();
    atualizarTurnoUI();
    
    if (turnoAtual === meuNumeroJogador) {
        iniciarTimer();
    }
}

function processarJogada(dados) {
    letrasChutadas = new Set(dados.letrasChutadas);
    palavraExibida = dados.palavra;
    erros = dados.erros;
    turnoAtual = dados.turno;
    
    atualizarPalavraExibida();
    atualizarBonecosUI();
    atualizarTurnoUI();
    
    // Mostra feedback visual da jogada
    if (dados.resultado === 'acerto') {
        mostrarFeedback('✓ Letra correta!', 'green');
    } else if (dados.resultado === 'erro') {
        mostrarFeedback('✗ Letra incorreta!', 'red');
    }
    
    // Se é meu turno, inicia o timer
    if (turnoAtual === meuNumeroJogador && jogoEstaAtivo) {
        iniciarTimer();
    } else {
        clearInterval(timerInterval);
    }
    
    // Verifica fim de jogo
    if (dados.status === 'vitoria' || dados.status === 'derrota') {
        finalizarJogo(dados.status);
    }
}

// --- 5. LÓGICA DE TEMPO E TURNO ---
function iniciarTimer() {
    clearInterval(timerInterval);
    let segundos = 15;
    timerEl.textContent = `${segundos}s`;
    timerEl.style.color = 'white';
    
    timerInterval = setInterval(() => {
        segundos--;
        timerEl.textContent = `${segundos}s`;
        
        if (segundos <= 5) {
            timerEl.style.color = '#ff5555';
        }
        
        if (segundos <= 0) {
            clearInterval(timerInterval);
            // Tempo esgotado - passa o turno automaticamente
            // O servidor não precisa ser notificado, apenas passa visualmente
            console.log('Tempo esgotado!');
        }
    }, 1000);
}

function atualizarTurnoUI() {
    if (turnoAtual === 1) {
        h2Jogador1.classList.add('active-turn');
        h2Jogador2.classList.remove('active-turn');
    } else {
        h2Jogador1.classList.remove('active-turn');
        h2Jogador2.classList.add('active-turn');
    }
}

// --- 6. PROCESSAMENTO DE JOGADAS ---
async function processarChute(letra) {
    if (!jogoEstaAtivo || letrasChutadas.has(letra)) return;
    if (turnoAtual !== meuNumeroJogador) {
        mostrarFeedback('Não é seu turno!', 'orange');
        return;
    }
    
    letra = letra.toUpperCase();
    letrasChutadas.add(letra);
    desabilitarTeclaVisual(letra);
    clearInterval(timerInterval);
    
    // Envia jogada para o servidor
    enviarEvento({
        tipo: 'jogada',
        letra: letra
    });
}

// --- 7. ATUALIZAÇÃO DE UI ---
function atualizarPalavraExibida() {
    const palavraFormatada = palavraExibida || gerarPalavraOculta();
    palavraP1_El.textContent = palavraFormatada;
    palavraP2_El.textContent = palavraFormatada;
}

function gerarPalavraOculta() {
    if (!palavraSecreta) return '';
    return palavraSecreta.split('').map(l => l === ' ' ? '  ' : '_ ').join('').trim();
}

function atualizarBonecosUI() {
    const indiceP1 = Math.min(erros + 1, 7);
    const indiceP2 = Math.min(erros + 1, 7);
    
    if (bonecoP1_El) {
        bonecoP1_El.src = `/public/assets/images/bob${indiceP1}.png`;
    }
    if (bonecoP2_El) {
        bonecoP2_El.src = `/public/assets/images/patrick${indiceP2}.png`;
    }
}

function desabilitarTeclaVisual(letra) {
    const btn = [...tecladoContainer.querySelectorAll('.tecla')]
        .find(b => b.textContent === letra);
    if (btn) btn.disabled = true;
}

function mostrarFeedback(mensagem, cor) {
    // Cria um elemento temporário para mostrar feedback
    const feedback = document.createElement('div');
    feedback.textContent = mensagem;
    feedback.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${cor === 'green' ? '#4CAF50' : cor === 'red' ? '#f44336' : '#ff9800'};
        color: white;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 24px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.remove();
    }, 1500);
}

function finalizarJogo(status) {
    jogoEstaAtivo = false;
    clearInterval(timerInterval);
    
    if (status === 'vitoria') {
        mostrarFeedback('Você venceu!', 'green');
    } else {
        mostrarFeedback('Você perdeu!', 'red');
    }
    
    setTimeout(() => {
        window.location.href = status === 'vitoria' ? 'win.html' : 'lost.html';
    }, 3000);
}

// --- 8. EVENT LISTENERS ---
function configurarTecladoVirtual() {
    if (!tecladoContainer) return;
    tecladoContainer.addEventListener('click', e => {
        if (e.target.classList.contains('tecla') && !e.target.disabled) {
            processarChute(e.target.textContent);
        }
    });
}

function lidarComChuteDeTecladoFisico(e) {
    const letra = e.key.toUpperCase();
    if (letra.length === 1 && letra >= 'A' && letra <= 'Z') {
        const btn = [...tecladoContainer.querySelectorAll('.tecla')]
            .find(b => b.textContent === letra);
        if (btn && !btn.disabled) {
            processarChute(letra);
        }
    }
}
