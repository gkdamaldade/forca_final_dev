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
let meuSocketId = null; // Socket ID deste jogador (para identificação única)
let adversarioNome = '';
let adversarioSocketId = null; // Socket ID do adversário
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
    console.log('=== INICIANDO JOGO ===');
    console.log('Dados recebidos:', dados);
    
    meuNumeroJogador = dados.jogador;
    meuSocketId = dados.meuSocketId || getMeuSocketId(); // Usa socketId do servidor ou busca localmente
    adversarioNome = dados.adversario;
    adversarioSocketId = dados.adversarioSocketId;
    palavraSecreta = dados.palavraSecreta || dados.palavra; // Usa palavraSecreta se disponível
    palavraExibida = dados.palavra; // Palavra oculta para exibição
    turnoAtual = dados.turno !== undefined ? dados.turno : 1; // Garante que sempre tenha um turno inicial
    categoria = dados.categoria;
    
    console.log(`Jogador ${meuNumeroJogador} - Socket ID: ${meuSocketId}`);
    console.log(`Turno atual: ${turnoAtual}, Meu número: ${meuNumeroJogador}`);
    console.log(`É meu turno? ${turnoAtual === meuNumeroJogador}`);
    
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
    atualizarTecladoDesabilitado(); // Desabilita letras já chutadas
    
    // Sempre inicia o timer se for o turno do jogador
    if (turnoAtual === meuNumeroJogador) {
        console.log(`✓ É meu turno! Iniciando timer...`);
        iniciarTimer();
    } else {
        console.log(`✗ Não é meu turno. Turno atual: ${turnoAtual}, Meu número: ${meuNumeroJogador}`);
        timerEl.textContent = 'Aguardando...';
        timerEl.style.color = '#888';
    }
}

function processarJogada(dados) {
    console.log('Processando jogada:', dados);
    
    // Se a letra foi repetida, reabilita a tecla (não foi processada)
    if (dados.resultado === 'repetida') {
        const btn = [...tecladoContainer.querySelectorAll('.tecla')]
            .find(b => b.textContent === dados.letra);
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
        mostrarFeedback('Letra já foi chutada!', 'orange');
        
        // Se ainda é meu turno, reinicia o timer
        if (turnoAtual === meuNumeroJogador && jogoEstaAtivo) {
            iniciarTimer();
        }
        return;
    }
    
    // Atualiza estado apenas se a jogada foi válida
    letrasChutadas = new Set(dados.letrasChutadas || []);
    palavraExibida = dados.palavra;
    erros = dados.erros || 0;
    turnoAtual = dados.turno || turnoAtual;
    
    atualizarPalavraExibida();
    atualizarBonecosUI();
    atualizarTurnoUI();
    atualizarTecladoDesabilitado(); // Atualiza teclado com letras já chutadas
    
    // Mostra feedback visual da jogada
    if (dados.resultado === 'acerto') {
        mostrarFeedback('✓ Letra correta!', 'green');
    } else if (dados.resultado === 'erro') {
        mostrarFeedback('✗ Letra incorreta!', 'red');
    }
    
    // Limpa o timer anterior
    clearInterval(timerInterval);
    
    // Se é meu turno, inicia o timer
    if (turnoAtual === meuNumeroJogador && jogoEstaAtivo) {
        console.log(`É meu turno agora (jogador ${meuNumeroJogador}), iniciando timer`);
        iniciarTimer();
    } else {
        console.log(`Não é meu turno (jogador ${meuNumeroJogador}, turno atual: ${turnoAtual})`);
        timerEl.textContent = 'Aguardando...';
        timerEl.style.color = '#888';
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
    console.log(`Atualizando UI do turno: turnoAtual=${turnoAtual}, meuNumeroJogador=${meuNumeroJogador}`);
    
    // Remove a classe de todos primeiro
    h2Jogador1.classList.remove('active-turn');
    h2Jogador2.classList.remove('active-turn');
    
    // Adiciona a classe no jogador do turno
    if (turnoAtual === 1) {
        h2Jogador1.classList.add('active-turn');
        console.log('✓ Jogador 1 está no turno (adicionado active-turn)');
    } else if (turnoAtual === 2) {
        h2Jogador2.classList.add('active-turn');
        console.log('✓ Jogador 2 está no turno (adicionado active-turn)');
    } else {
        console.warn('⚠ Turno inválido:', turnoAtual);
    }
    
    // Atualiza visualmente qual jogador pode jogar
    if (turnoAtual === meuNumeroJogador) {
        console.log('✓ É meu turno - posso jogar!');
    } else {
        console.log('✗ Não é meu turno - aguardando...');
    }
}

// --- 6. PROCESSAMENTO DE JOGADAS ---
async function processarChute(letra) {
    if (!jogoEstaAtivo) {
        mostrarFeedback('Jogo não está ativo!', 'orange');
        return;
    }
    
    letra = letra.toUpperCase();
    
    // Verifica se a letra já foi chutada (verificação local para feedback rápido)
    if (letrasChutadas.has(letra)) {
        mostrarFeedback('Letra já foi chutada!', 'orange');
        return;
    }
    
    // Verifica se é o turno do jogador
    if (turnoAtual !== meuNumeroJogador) {
        mostrarFeedback('Não é seu turno!', 'orange');
        return;
    }
    
    // Desabilita a tecla visualmente imediatamente (feedback instantâneo)
    // Mas não adiciona ao set ainda - o servidor vai confirmar
    desabilitarTeclaVisual(letra);
    
    // Pausa o timer enquanto processa
    clearInterval(timerInterval);
    timerEl.textContent = 'Processando...';
    timerEl.style.color = '#888';
    
    // Envia jogada para o servidor
    console.log(`Enviando jogada: ${letra} (turno: ${turnoAtual}, meu número: ${meuNumeroJogador})`);
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
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }
}

function atualizarTecladoDesabilitado() {
    // Desabilita todas as letras já chutadas e impede cliques
    if (!tecladoContainer) return;
    
    tecladoContainer.querySelectorAll('.tecla').forEach(btn => {
        const letra = btn.textContent;
        if (letrasChutadas.has(letra)) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.style.pointerEvents = 'none'; // Impede completamente qualquer interação
            // Remove event listeners se houver
            btn.onclick = null;
        } else {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.style.pointerEvents = 'auto'; // Permite interação
        }
    });
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
        const btn = e.target.closest('.tecla');
        if (!btn) return;
        
        // Verifica múltiplas condições antes de processar
        if (btn.disabled) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        
        const letra = btn.textContent;
        
        // Verifica se a letra já foi chutada (dupla verificação)
        if (letrasChutadas.has(letra)) {
            e.preventDefault();
            e.stopPropagation();
            mostrarFeedback('Letra já foi chutada!', 'orange');
            return false;
        }
        
        // Verifica se é o turno do jogador
        if (turnoAtual !== meuNumeroJogador) {
            e.preventDefault();
            e.stopPropagation();
            mostrarFeedback('Não é seu turno!', 'orange');
            return false;
        }
        
        // Verifica se o jogo está ativo
        if (!jogoEstaAtivo) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        
        processarChute(letra);
    });
}

function lidarComChuteDeTecladoFisico(e) {
    const letra = e.key.toUpperCase();
    if (letra.length === 1 && letra >= 'A' && letra <= 'Z') {
        const btn = [...tecladoContainer.querySelectorAll('.tecla')]
            .find(b => b.textContent === letra);
        
        // Verifica múltiplas condições antes de processar
        if (!btn || btn.disabled) {
            e.preventDefault();
            return false;
        }
        
        // Verifica se a letra já foi chutada
        if (letrasChutadas.has(letra)) {
            e.preventDefault();
            mostrarFeedback('Letra já foi chutada!', 'orange');
            return false;
        }
        
        // Verifica se é o turno do jogador
        if (turnoAtual !== meuNumeroJogador) {
            e.preventDefault();
            mostrarFeedback('Não é seu turno!', 'orange');
            return false;
        }
        
        // Verifica se o jogo está ativo
        if (!jogoEstaAtivo) {
            e.preventDefault();
            return false;
        }
        
        processarChute(letra);
    }
}
