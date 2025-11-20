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
const preGameWrapper = document.querySelector('.pre-game-wrapper');
const jogoContainer = document.querySelector('.jogo-container');
const botaoPronto = document.querySelector('.botao-pronto');
const contadorProntosEl = document.querySelector('.contador');
const codigoSalaEl = document.querySelector('[data-codigo-sala]');

// --- 2. ESTADO DO JOGO ---
let meuNumeroJogador = null; // 1 ou 2
let meuSocketId = null; // Socket ID deste jogador (para identificação única)
let meuPlayerId = null; // ID do jogador no banco de dados
let adversarioNome = '';
let adversarioSocketId = null; // Socket ID do adversário
let palavraSecreta = ''; // Minha palavra secreta
let palavraExibida = ''; // Minha palavra exibida
let palavraAdversarioExibida = ''; // Palavra do adversário exibida
let turnoAtual = 1;
let errosJogador1 = 0; // Erros do jogador 1
let errosJogador2 = 0; // Erros do jogador 2
let letrasChutadas = new Set();
let vidas = [3, 3]; // [vidas jogador 1, vidas jogador 2]
let jogoEstaAtivo = false;
let timerInterval = null;
let sala = '';
let categoria = '';
let nomeJogador = '';
let instanceId = '';
let estaNoModoPreparacao = true;
let usuarioPronto = false;
const jogadoresProntos = new Set();
let poderesSelecionados = new Set(); // Set com os nomes dos poderes selecionados (ex: "liberar_letra", "vida_extra")
const MAX_PODERES = 3;

// --- 3. INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 DOMContentLoaded - Inicializando jogo...');
    
    const urlParams = new URLSearchParams(window.location.search);
    sala = urlParams.get('sala');
    categoria = urlParams.get('categoria') || 'Geral';
    
    console.log(`📋 Parâmetros da URL: sala=${sala}, categoria=${categoria}`);
    
    if (!sala) {
        console.error('❌ Sala não encontrada na URL');
        if (categoriaEl) {
            categoriaEl.textContent = 'Erro: Sala não encontrada';
        }
        return;
    }

    // Obtém o nome do token
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('❌ Token não encontrado');
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        nomeJogador = payload.nome || payload.name || '';
        meuPlayerId = payload.id || null; // Armazena o ID do jogador do token
        console.log(`👤 Nome do jogador: ${nomeJogador}, ID: ${meuPlayerId}`);
        instanceId = `${nomeJogador}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } catch (e) {
        console.error('❌ Erro ao decodificar token:', e);
        window.location.href = 'login.html';
        return;
    }

    if (codigoSalaEl) {
        codigoSalaEl.textContent = sala;
    }

    configurarInterfacePreparacao();
    
    // Configura listeners ANTES de conectar (será reconfigurado após conexão se necessário)
    configurarListenersSocket();
    
    // Conecta ao socket
    console.log(`🔌 Conectando ao socket: sala=${sala}, nome=${nomeJogador}, playerId=${meuPlayerId}, categoria=${categoria}`);
    conectarSocket(sala, nomeJogador, meuPlayerId, categoria);
    
    // Reconfigura listeners após conexão para garantir que estão ativos
    setTimeout(() => {
        configurarListenersSocket();
        console.log(`✅ Listeners de socket reconfigurados após conexão`);
    }, 200);
    
    // Aguarda um pouco para garantir que o socket está conectado
    setTimeout(() => {
        console.log('⏳ Aguardando evento de início do jogo...');
        console.log(`📊 Estado atual: meuNumeroJogador=${meuNumeroJogador}, turnoAtual=${turnoAtual}, jogoEstaAtivo=${jogoEstaAtivo}`);
    }, 500);
    
    // Configura teclado virtual e físico
    configurarTecladoVirtual();
    document.addEventListener('keydown', lidarComChuteDeTecladoFisico);
    
    console.log('✅ Inicialização completa');
});

function configurarInterfacePreparacao() {
    console.log(`[${instanceId}] 🔧 Configurando interface de preparação...`);
    
    estaNoModoPreparacao = true;
    usuarioPronto = false;
    jogadoresProntos.clear();
    poderesSelecionados.clear(); // Reseta poderes selecionados
    
    if (preGameWrapper) {
        preGameWrapper.classList.remove('hidden');
        console.log(`[${instanceId}] ✅ Painel de preparação exibido`);
    } else {
        console.error(`[${instanceId}] ❌ Elemento .pre-game-wrapper não encontrado!`);
    }
    
    if (jogoContainer) {
        jogoContainer.classList.add('hidden');
        console.log(`[${instanceId}] ✅ Painel de jogo ocultado`);
    } else {
        console.error(`[${instanceId}] ❌ Elemento .jogo-container não encontrado!`);
    }

    // Atualiza o nome do jogador na tela de preparação
    atualizarNomeJogadorPreparacao();

    // Configura seleção de poderes
    configurarSelecaoPoderes();

    // Inicializa contador em 0/2
    atualizarContadorProntos(0);

    // Atualiza contador de poderes selecionados
    atualizarContadorPoderes();

    if (botaoPronto) {
        // Remove listeners antigos para evitar duplicação
        botaoPronto.removeEventListener('click', aoClicarBotaoPronto);
        // Adiciona novo listener
        botaoPronto.addEventListener('click', aoClicarBotaoPronto);
        
        botaoPronto.disabled = false;
        botaoPronto.textContent = 'Pronto';
        botaoPronto.style.opacity = '1';
        botaoPronto.style.cursor = 'pointer';
        console.log(`[${instanceId}] ✅ Botão pronto configurado e habilitado`);
    } else {
        console.error(`[${instanceId}] ❌ Elemento .botao-pronto não encontrado!`);
    }
}

function atualizarNomeJogadorPreparacao() {
    const nomeJogadorEl = document.getElementById('nome-jogador-prep');
    if (nomeJogadorEl && nomeJogador) {
        nomeJogadorEl.textContent = nomeJogador;
    }
}

function configurarSelecaoPoderes() {
    const botoesPoder = document.querySelectorAll('#poderes-container-atual .poder');
    
    botoesPoder.forEach(botao => {
        // Remove listeners antigos
        botao.removeEventListener('click', lidarComCliquePoder);
        // Adiciona novo listener
        botao.addEventListener('click', lidarComCliquePoder);
        
        // Remove estado selecionado
        botao.classList.remove('selecionado');
        botao.disabled = false;
    });
}

function lidarComCliquePoder(e) {
    const botao = e.currentTarget;
    const poderId = botao.getAttribute('data-poder');
    
    if (!poderId) {
        console.warn(`⚠️ Botão de poder sem data-poder:`, botao);
        return;
    }
    
    // Se já está selecionado, remove
    if (poderesSelecionados.has(poderId)) {
        poderesSelecionados.delete(poderId);
        botao.classList.remove('selecionado');
        console.log(`[${instanceId}] ➖ Poder deselecionado: ${poderId}`);
    } else {
        // Se não está selecionado e não atingiu o máximo
        if (poderesSelecionados.size < MAX_PODERES) {
            poderesSelecionados.add(poderId);
            botao.classList.add('selecionado');
            console.log(`[${instanceId}] ➕ Poder selecionado: ${poderId}`);
        } else {
            // Atingiu o máximo
            console.log(`[${instanceId}] ⚠️ Máximo de ${MAX_PODERES} poderes atingido`);
            mostrarFeedback(`Você pode selecionar no máximo ${MAX_PODERES} poderes`, 'orange');
            return;
        }
    }
    
    // Atualiza contador de poderes selecionados
    atualizarContadorPoderes();
    
    // Atualiza estado dos botões (desabilita os não selecionados se atingiu o máximo)
    atualizarEstadoBotoesPoderes();
}

function atualizarContadorPoderes() {
    const contadorEl = document.getElementById('contador-selecionados');
    if (contadorEl) {
        contadorEl.textContent = poderesSelecionados.size;
    }
}

function atualizarEstadoBotoesPoderes() {
    const botoesPoder = document.querySelectorAll('#poderes-container-atual .poder');
    const atingiuMaximo = poderesSelecionados.size >= MAX_PODERES;
    
    botoesPoder.forEach(botao => {
        const poderId = botao.getAttribute('data-poder');
        const estaSelecionado = poderesSelecionados.has(poderId);
        
        // Se atingiu o máximo e o botão não está selecionado, desabilita
        if (atingiuMaximo && !estaSelecionado) {
            botao.disabled = true;
            botao.style.opacity = '0.4';
            botao.style.cursor = 'not-allowed';
        } else {
            botao.disabled = false;
            botao.style.opacity = '1';
            botao.style.cursor = 'pointer';
        }
    });
}

function aoClicarBotaoPronto() {
    console.log(`[${instanceId}] 🖱️ Botão pronto clicado!`);
    
    if (usuarioPronto) {
        console.log(`[${instanceId}] ⚠️ Botão pronto já foi clicado. Ignorando novo clique.`);
        return;
    }

    console.log(`[${instanceId}] ✅ Marcando usuário como pronto localmente...`);
    usuarioPronto = true;
    travarBotaoPronto();

    // Prepara lista de poderes selecionados para enviar
    const poderesArray = Array.from(poderesSelecionados);
    console.log(`[${instanceId}] 🎯 Poderes selecionados:`, poderesArray);

    console.log(`[${instanceId}] 📤 Enviando evento 'pronto' para o servidor...`);
    enviarEvento({
        tipo: 'pronto',
        nome: nomeJogador,
        poderes: poderesArray // Envia array de poderes selecionados
    });
}

function travarBotaoPronto() {
    if (!botaoPronto) return;
    botaoPronto.disabled = true;
    botaoPronto.textContent = 'Pronto!';
    botaoPronto.style.opacity = '0.6';
    botaoPronto.style.cursor = 'not-allowed';
}

function desbloquearBotaoPronto() {
    if (!botaoPronto) return;
    botaoPronto.disabled = false;
    botaoPronto.textContent = 'Pronto';
    botaoPronto.style.opacity = '1';
    botaoPronto.style.cursor = 'pointer';
}

function atualizarContadorProntos(total) {
    if (!contadorProntosEl) {
        console.warn('⚠️ Elemento .contador não encontrado!');
        return;
    }
    const valorSeguro = Math.max(0, Math.min(2, total || 0));
    contadorProntosEl.textContent = `( ${valorSeguro} / 2 )`;
    console.log(`[${instanceId}] 📊 Contador atualizado: ${valorSeguro}/2`);
}

function ativarModoPreparacao(evento = {}) {
    estaNoModoPreparacao = true;
    jogoEstaAtivo = false;

    if (preGameWrapper) preGameWrapper.classList.remove('hidden');
    if (jogoContainer) jogoContainer.classList.add('hidden');

    // Se não há total no evento, reseta para 0/2
    if (evento.total !== undefined) {
        atualizarContadorProntos(evento.total);
    } else {
        atualizarContadorProntos(0);
    }

    if (!usuarioPronto) {
        desbloquearBotaoPronto();
    }
}

function registrarEventoPronto(evento) {
    console.log(`[${instanceId}] 📨 Processando evento 'pronto':`, evento);
    console.log(`[${instanceId}] 📦 Dados completos do evento:`, JSON.stringify(evento, null, 2));
    
    // Adiciona o jogador ao set de prontos
    if (evento.socketId) {
        jogadoresProntos.add(evento.socketId);
        console.log(`[${instanceId}] ✅ Adicionado socket.id ao set: ${evento.socketId}`);
    } else if (evento.nome) {
        jogadoresProntos.add(evento.nome);
        console.log(`[${instanceId}] ✅ Adicionado nome ao set: ${evento.nome}`);
    }

    // SEMPRE atualiza contador com o total do servidor (mais confiável)
    // O servidor envia o total correto, então usamos ele diretamente
    const totalProntos = evento.total !== undefined && evento.total !== null ? evento.total : jogadoresProntos.size;
    console.log(`[${instanceId}] 📊 Total de prontos recebido do servidor: ${evento.total}, usando: ${totalProntos}/2`);
    atualizarContadorProntos(totalProntos);

    // Verifica se o evento é do próprio usuário
    const meuSocketAtual = getMeuSocketId();
    const eventoEDoMeuSocket = evento.socketId && evento.socketId === meuSocketAtual;
    const eventoEDoMeuNome = evento.nome === nomeJogador;

    console.log(`[${instanceId}] 🔍 Verificação: meuSocketId=${meuSocketAtual}, eventoSocketId=${evento.socketId}, eventoEDoMeuSocket=${eventoEDoMeuSocket}, eventoEDoMeuNome=${eventoEDoMeuNome}, usuarioPronto=${usuarioPronto}`);

    if ((eventoEDoMeuSocket || (eventoEDoMeuNome && !evento.socketId)) && !usuarioPronto) {
        console.log(`[${instanceId}] ✅ Usuário ${nomeJogador} marcado como pronto via evento do servidor`);
        usuarioPronto = true;
        travarBotaoPronto();
    }

    // Quando ambos estiverem prontos, o servidor enviará o evento 'inicio' automaticamente
    // Não precisamos fazer nada aqui, apenas aguardar o evento 'inicio'
    if (totalProntos === 2) {
        console.log(`[${instanceId}] 🎮 Ambos os jogadores estão prontos! Aguardando evento 'inicio' do servidor...`);
        console.log(`[${instanceId}] ⏳ Se o evento 'inicio' não chegar em 3 segundos, pode haver um problema no servidor.`);
        
        // Timeout de segurança: se o evento 'inicio' não chegar em 3 segundos, loga um aviso
        setTimeout(() => {
            if (estaNoModoPreparacao && !jogoEstaAtivo) {
                console.warn(`[${instanceId}] ⚠️ AVISO: Evento 'inicio' não chegou após 3 segundos com ambos prontos!`);
                console.warn(`[${instanceId}] 📊 Estado atual: estaNoModoPreparacao=${estaNoModoPreparacao}, jogoEstaAtivo=${jogoEstaAtivo}`);
                console.warn(`[${instanceId}] 🔍 Verifique os logs do servidor para ver se o evento 'inicio' foi enviado.`);
            }
        }, 3000);
    }
}

function ocultarModoPreparacao() {
    if (!estaNoModoPreparacao) return;
    estaNoModoPreparacao = false;
    jogadoresProntos.clear();
    if (preGameWrapper) preGameWrapper.classList.add('hidden');
    if (jogoContainer) jogoContainer.classList.remove('hidden');
}

// --- 4. SOCKET LISTENERS ---
function configurarListenersSocket() {
    console.log(`[${instanceId}] 🔧 Configurando listeners de socket...`);
    aoReceberEvento((evento) => {
        console.log(`[${instanceId}] 📨 Evento recebido:`, evento);
        console.log(`[${instanceId}] 📋 Tipo do evento:`, evento.tipo);
        console.log(`[${instanceId}] 📦 Dados completos:`, JSON.stringify(evento, null, 2));
        console.log(`[${instanceId}] 📊 Estado ANTES do evento: meuNumeroJogador=${meuNumeroJogador}, jogoEstaAtivo=${jogoEstaAtivo}`);
        
        if (evento.tipo === 'inicio') {
            console.log('🎮 Evento INICIO recebido! Iniciando jogo...');
            console.log('📦 Dados do evento inicio:', JSON.stringify(evento, null, 2));
            ocultarModoPreparacao();
            iniciarJogo(evento);
            console.log('✅ Jogo iniciado! meuNumeroJogador agora é:', meuNumeroJogador);
        } else if (evento.tipo === 'jogada') {
            processarJogada(evento);
        } else if (evento.tipo === 'turnoTrocado') {
            console.log('🔄 Evento TURNO TROCADO recebido:', evento);
            // Atualiza o estado do jogo com os dados recebidos
            turnoAtual = parseInt(evento.turno) || turnoAtual;
            
            // Atualiza erros de ambos os jogadores
            errosJogador1 = evento.errosJogador1 || 0;
            errosJogador2 = evento.errosJogador2 || 0;
            
            // Atualiza palavras baseado no número do jogador
            if (meuNumeroJogador === 1) {
                palavraExibida = evento.palavraJogador1 || palavraExibida;
                palavraAdversarioExibida = evento.palavraJogador2 || palavraAdversarioExibida;
                letrasChutadas = new Set(evento.letrasChutadasJogador1 || []);
            } else {
                palavraExibida = evento.palavraJogador2 || palavraExibida;
                palavraAdversarioExibida = evento.palavraJogador1 || palavraAdversarioExibida;
                letrasChutadas = new Set(evento.letrasChutadasJogador2 || []);
            }
            
            if (evento.vidas) {
                vidas = evento.vidas;
            }
            
            // Atualiza a UI
            atualizarVidasUI();
            atualizarPalavraExibida();
            atualizarBonecosUI();
            atualizarTurnoUI();
            atualizarTecladoDesabilitado();
            
            // Limpa o timer anterior e inicia novo se for meu turno
            clearInterval(timerInterval);
            const turnoAtualNum = Number(turnoAtual) || 0;
            const meuNumeroNum = Number(meuNumeroJogador) || 0;
            
            if (turnoAtualNum === meuNumeroNum && meuNumeroNum > 0 && jogoEstaAtivo) {
                console.log(`✓ É meu turno agora (jogador ${meuNumeroNum}), iniciando timer`);
                iniciarTimer();
            } else {
                console.log(`✗ Não é meu turno (jogador ${meuNumeroNum}, turno atual: ${turnoAtualNum})`);
                if (timerEl) {
                    timerEl.textContent = 'Aguardando...';
                    timerEl.style.color = '#888';
                }
            }
        } else if (evento.tipo === 'fim') {
            console.log('🏆 Evento FIM recebido:', evento);
            const vencedor = evento.vencedor;
            if (vencedor === meuNumeroJogador) {
                finalizarJogo('vitoria');
            } else {
                finalizarJogo('derrota');
            }
        } else if (evento.tipo === 'preparacao') {
            console.log('⏳ Evento PREPARACAO recebido - aguardando ambos estarem prontos...');
            console.log('📦 Dados do evento preparacao:', JSON.stringify(evento, null, 2));
            ativarModoPreparacao(evento);
        } else if (evento.tipo === 'pronto') {
            console.log('✅ Evento PRONTO recebido na tela unificada:', evento);
            registrarEventoPronto(evento);
        } else if (evento.tipo === 'erro') {
            console.warn('❌ Erro do servidor:', evento.mensagem);
            mostrarFeedback(evento.mensagem || 'Erro no servidor', 'red');
            // Se o erro for "não é seu turno", não faz nada além de mostrar feedback
            // O turno será atualizado quando o servidor enviar o próximo evento 'jogada'
        } else {
            console.log('ℹ️ Evento não tratado:', evento.tipo);
        }
    });
}

function iniciarJogo(dados) {
    console.log('=== INICIANDO JOGO ===');
    console.log('Dados recebidos:', dados);
    console.log('Tipo de dados.jogador:', typeof dados.jogador, dados.jogador);
    console.log('Tipo de dados.turno:', typeof dados.turno, dados.turno);
    
    // Validação crítica: verifica se dados.jogador existe e é válido
    if (dados.jogador === undefined || dados.jogador === null) {
        console.error('❌ ERRO CRÍTICO: dados.jogador não foi enviado pelo servidor!');
        console.error('Dados completos recebidos:', JSON.stringify(dados, null, 2));
        mostrarFeedback('Erro: dados do jogo incompletos. Recarregue a página.', 'red');
        return;
    }
    
    // Converte para número de forma mais robusta
    const jogadorNum = Number(dados.jogador);
    if (isNaN(jogadorNum) || (jogadorNum !== 1 && jogadorNum !== 2)) {
        console.error('❌ ERRO CRÍTICO: dados.jogador inválido! Valor:', dados.jogador, 'Tipo:', typeof dados.jogador);
        console.error('Dados completos recebidos:', JSON.stringify(dados, null, 2));
        mostrarFeedback('Erro: número de jogador inválido. Recarregue a página.', 'red');
        return;
    }
    
    meuNumeroJogador = jogadorNum; // Agora sabemos que é 1 ou 2
    meuSocketId = dados.meuSocketId || getMeuSocketId(); // Usa socketId do servidor ou busca localmente
    adversarioNome = dados.adversario;
    adversarioSocketId = dados.adversarioSocketId;
    palavraSecreta = dados.palavraSecreta || dados.palavra; // Minha palavra secreta
    palavraExibida = dados.palavra || ''; // Minha palavra oculta para exibição
    palavraAdversarioExibida = dados.palavraAdversario || ''; // Palavra do adversário exibida
    turnoAtual = Number(dados.turno) || 1; // Garante que sempre tenha um turno inicial e seja um número
    categoria = dados.categoria || 'Geral';
    vidas = dados.vidas || [3, 3]; // Vidas de cada jogador [J1, J2]
    
    console.log(`📝 Palavras recebidas: Minha="${palavraExibida}", Adversário="${palavraAdversarioExibida}"`);
    console.log(`💚 Vidas iniciais: J1=${vidas[0]}, J2=${vidas[1]}`);
    
    console.log(`✅ Jogador ${meuNumeroJogador} (tipo: ${typeof meuNumeroJogador}) - Socket ID: ${meuSocketId}`);
    console.log(`🔄 Turno atual: ${turnoAtual} (tipo: ${typeof turnoAtual}), Meu número: ${meuNumeroJogador} (tipo: ${typeof meuNumeroJogador})`);
    console.log(`✅ É meu turno? ${turnoAtual === meuNumeroJogador} (comparação: ${turnoAtual} === ${meuNumeroJogador})`);
    
    // Validação adicional do turno
    if (turnoAtual !== 1 && turnoAtual !== 2) {
        console.warn('⚠️ Turno inválido recebido:', turnoAtual, '- Corrigindo para 1');
        turnoAtual = 1;
    }
    
    // Atualiza nomes dos jogadores
    if (meuNumeroJogador === 1) {
        h2Jogador1.textContent = 'Você';
        h2Jogador2.textContent = adversarioNome;
    } else {
        h2Jogador1.textContent = adversarioNome;
        h2Jogador2.textContent = 'Você';
    }
    
    jogoEstaAtivo = true;
    errosJogador1 = 0;
    errosJogador2 = 0;
    letrasChutadas.clear();
    
    categoriaEl.textContent = categoria;
    atualizarVidasUI();
    atualizarPalavraExibida();
    atualizarBonecosUI();
    atualizarTurnoUI();
    atualizarTecladoDesabilitado(); // Desabilita letras já chutadas E bloqueia se não for o turno
    
    // Sempre inicia o timer se for o turno do jogador
    const turnoAtualNum = Number(turnoAtual) || 0;
    const meuNumeroNum = Number(meuNumeroJogador) || 0;
    
    console.log(`🔄 Verificando turno para timer: turnoAtual=${turnoAtualNum}, meuNumero=${meuNumeroNum}, são iguais? ${turnoAtualNum === meuNumeroNum}`);
    
    if (turnoAtualNum === meuNumeroNum && meuNumeroNum > 0) {
        console.log(`✓ É meu turno! Iniciando timer...`);
        if (timerEl) {
            iniciarTimer();
        } else {
            console.error('❌ timerEl não encontrado!');
        }
    } else {
        console.log(`✗ Não é meu turno. Turno atual: ${turnoAtualNum}, Meu número: ${meuNumeroNum}`);
        if (timerEl) {
            timerEl.textContent = 'Aguardando...';
            timerEl.style.color = '#888';
        }
        // Garante que o teclado está desabilitado quando não é o turno
        atualizarTecladoDesabilitado();
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
    
    // Atualiza erros de ambos os jogadores separadamente
    errosJogador1 = dados.errosJogador1 || 0;
    errosJogador2 = dados.errosJogador2 || 0;
    
    // Atualiza estado apenas se a jogada foi válida
    // O servidor envia palavras separadas para cada jogador
    if (meuNumeroJogador === 1) {
        palavraExibida = dados.palavraJogador1 || palavraExibida;
        palavraAdversarioExibida = dados.palavraJogador2 || palavraAdversarioExibida;
        letrasChutadas = new Set(dados.letrasChutadasJogador1 || []);
    } else {
        palavraExibida = dados.palavraJogador2 || palavraExibida;
        palavraAdversarioExibida = dados.palavraJogador1 || palavraAdversarioExibida;
        letrasChutadas = new Set(dados.letrasChutadasJogador2 || []);
    }
    
    turnoAtual = parseInt(dados.turno) || turnoAtual; // Garante que seja um número
    
    // Atualiza vidas se fornecidas
    if (dados.vidas) {
        vidas = dados.vidas;
        atualizarVidasUI();
    }
    
    // Verifica se alguém perdeu vida e se começou nova rodada
    if (dados.alguemPerdeuVida) {
        const jogadorQuePerdeu = dados.jogadorQuePerdeuVida;
        const motivo = dados.motivoPerdaVida;
        
        if (motivo === 'vitoria') {
            // Alguém completou a palavra, adversário perdeu vida
            if (jogadorQuePerdeu === meuNumeroJogador) {
                mostrarFeedback('❌ Você perdeu uma vida!', 'red');
            } else {
                mostrarFeedback('🎯 Adversário perdeu uma vida!', 'green');
            }
        } else if (motivo === 'erros') {
            // Alguém errou 6 vezes, ele mesmo perdeu vida
            if (jogadorQuePerdeu === meuNumeroJogador) {
                mostrarFeedback('❌ Você errou 6 vezes! Perdeu uma vida!', 'red');
            } else {
                mostrarFeedback('🎯 Adversário errou 6 vezes! Perdeu uma vida!', 'green');
            }
        }
        
        // Se começou nova rodada, reseta o estado
        if (dados.novaRodada) {
            console.log('🔄 Nova rodada iniciada! Resetando estado...');
            // Reseta letras chutadas e erros para nova rodada
            letrasChutadas = new Set();
            errosJogador1 = 0;
            errosJogador2 = 0;
            
            // Atualiza palavras com as novas
            if (meuNumeroJogador === 1) {
                palavraExibida = dados.palavraJogador1 || palavraExibida;
                palavraAdversarioExibida = dados.palavraJogador2 || palavraAdversarioExibida;
            } else {
                palavraExibida = dados.palavraJogador2 || palavraExibida;
                palavraAdversarioExibida = dados.palavraJogador1 || palavraAdversarioExibida;
            }
            
            // Reseta letras chutadas com as novas do servidor
            if (meuNumeroJogador === 1) {
                letrasChutadas = new Set(dados.letrasChutadasJogador1 || []);
            } else {
                letrasChutadas = new Set(dados.letrasChutadasJogador2 || []);
            }
            
            // Reseta o teclado para nova rodada
            atualizarTecladoDesabilitado();
            
            // Se começou nova rodada e é meu turno, inicia o timer
            const turnoAtualNum = Number(turnoAtual) || 0;
            const meuNumeroNum = Number(meuNumeroJogador) || 0;
            if (turnoAtualNum === meuNumeroNum && meuNumeroNum > 0 && jogoEstaAtivo) {
                console.log(`✓ Nova rodada iniciada! É meu turno (jogador ${meuNumeroNum}), iniciando timer`);
                iniciarTimer();
            } else {
                console.log(`✗ Nova rodada iniciada! Não é meu turno (jogador ${meuNumeroNum}, turno atual: ${turnoAtualNum})`);
                if (timerEl) {
                    timerEl.textContent = 'Aguardando...';
                    timerEl.style.color = '#888';
                }
            }
        }
    }
    
    console.log(`🔄 Turno atualizado após jogada: ${turnoAtual} (tipo: ${typeof turnoAtual})`);
    console.log(`💚 Vidas: J1=${vidas[0]}, J2=${vidas[1]}`);
    console.log(`❌ Erros: J1=${errosJogador1}, J2=${errosJogador2}`);
    
    atualizarPalavraExibida();
    atualizarBonecosUI();
    atualizarTurnoUI();
    atualizarTecladoDesabilitado(); // Atualiza teclado com letras já chutadas E bloqueia se não for o turno
    
    // Mostra feedback visual da jogada
    // Apenas mostra feedback de erro se foi o próprio jogador que errou
    if (dados.resultado === 'acerto') {
        mostrarFeedback('✓ Letra correta!', 'green');
    } else if (dados.resultado === 'erro' && dados.jogadorQueJogou === meuNumeroJogador) {
        // Só mostra erro se foi o próprio jogador que errou
        mostrarFeedback('✗ Letra incorreta!', 'red');
    } else if (dados.resultado === 'vitoria' && !dados.alguemPerdeuVida) {
        mostrarFeedback('🎯 Você completou a palavra!', 'green');
    }
    
    // Limpa o timer anterior
    clearInterval(timerInterval);
    
    // Se é meu turno e não começou nova rodada, inicia o timer (usando comparação numérica)
    if (!dados.novaRodada) {
        const turnoAtualNum = Number(turnoAtual) || 0;
        const meuNumeroNum = Number(meuNumeroJogador) || 0;
        
        if (turnoAtualNum === meuNumeroNum && meuNumeroNum > 0 && jogoEstaAtivo) {
            console.log(`✓ É meu turno agora (jogador ${meuNumeroNum}), iniciando timer`);
            iniciarTimer();
        } else {
            console.log(`✗ Não é meu turno (jogador ${meuNumeroNum}, turno atual: ${turnoAtualNum})`);
            if (timerEl) {
                timerEl.textContent = 'Aguardando...';
                timerEl.style.color = '#888';
            }
            // Garante que o teclado está desabilitado quando não é o turno
            atualizarTecladoDesabilitado();
        }
    }
}

// --- 5. LÓGICA DE TEMPO E TURNO ---
function iniciarTimer() {
    if (!timerEl) {
        console.error('❌ timerEl não encontrado! Não é possível iniciar o timer.');
        return;
    }
    
    clearInterval(timerInterval);
    let segundos = 15;
    timerEl.textContent = `${segundos}s`;
    timerEl.style.color = 'white';
    timerEl.classList.remove('timer-urgente'); // Remove classe urgente ao resetar
    
    console.log(`⏱️ Timer iniciado: ${segundos}s`);
    
    timerInterval = setInterval(() => {
        segundos--;
        if (timerEl) {
            timerEl.textContent = `${segundos}s`;
        }
        
        if (segundos <= 5 && timerEl) {
            timerEl.style.color = '#ff5555';
            timerEl.classList.add('timer-urgente'); // Adiciona classe para animação mais forte
        } else if (segundos > 5 && timerEl) {
            timerEl.classList.remove('timer-urgente'); // Remove classe quando > 5
            timerEl.style.color = 'white';
        }
        
        if (segundos <= 0) {
            clearInterval(timerInterval);
            // Tempo esgotado - passa o turno automaticamente
            console.log('⏱️ Tempo esgotado! Passando turno automaticamente...');
            if (timerEl) {
                timerEl.textContent = 'Tempo esgotado!';
                timerEl.style.color = '#ff5555';
            }
            
            // Envia evento ao servidor para passar o turno
            if (jogoEstaAtivo && meuNumeroJogador) {
                const turnoAtualNum = Number(turnoAtual) || 0;
                const meuNumeroNum = Number(meuNumeroJogador) || 0;
                
                // Só passa o turno se for realmente o turno do jogador
                if (turnoAtualNum === meuNumeroNum) {
                    console.log(`⏱️ Enviando evento de tempo esgotado para passar o turno...`);
                    enviarEvento({
                        tipo: 'tempoEsgotado'
                    });
                }
            }
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
    // Validação crítica: verifica se o jogo foi inicializado corretamente
    if (!meuNumeroJogador || meuNumeroJogador === 0 || (meuNumeroJogador !== 1 && meuNumeroJogador !== 2)) {
        console.error('❌ ERRO CRÍTICO: meuNumeroJogador não foi definido corretamente! Valor:', meuNumeroJogador);
        console.error('📊 Estado atual: jogoEstaAtivo=', jogoEstaAtivo, ', turnoAtual=', turnoAtual);
        mostrarFeedback('Erro: jogo não inicializado. Aguarde o evento de início.', 'red');
        return;
    }

    if (!jogoEstaAtivo) {
        mostrarFeedback('Jogo não está ativo!', 'orange');
        return;
    }

    // Converte para maiúscula (hífen não muda, cedilha vira Ç)
    letra = letra.toUpperCase();
    
    // Garante que cedilha minúscula vira maiúscula
    if (letra === 'ç' || letra === 'Ç') {
        letra = 'Ç';
    }

    // Verifica se a letra já foi chutada (verificação local para feedback rápido)
    if (letrasChutadas.has(letra)) {
        mostrarFeedback('Letra já foi chutada!', 'orange');
        return;
    }

    // Verifica se é o turno do jogador (usando comparação numérica)
    const turnoAtualNum = Number(turnoAtual) || 0;
    const meuNumeroNum = Number(meuNumeroJogador) || 0;

    console.log(`🎯 Verificando turno antes de chutar: turnoAtual=${turnoAtualNum}, meuNumero=${meuNumeroNum}, são iguais? ${turnoAtualNum === meuNumeroNum}`);

    if (turnoAtualNum !== meuNumeroNum || meuNumeroNum === 0) {
        console.warn(`⚠️ Tentativa de chute fora do turno: turnoAtual=${turnoAtualNum}, meuNumero=${meuNumeroNum}`);
        mostrarFeedback('Não é seu turno!', 'orange');
        return;
    }
    
    // Desabilita a tecla visualmente imediatamente (feedback instantâneo)
    // Mas não adiciona ao set ainda - o servidor vai confirmar
    desabilitarTeclaVisual(letra);
    
    // Pausa o timer enquanto processa
    clearInterval(timerInterval);
    if (timerEl) {
        timerEl.textContent = 'Processando...';
        timerEl.style.color = '#888';
    }
    
    // Envia jogada para o servidor
    console.log(`📤 Enviando jogada: ${letra} (turno: ${turnoAtual}, meu número: ${meuNumeroJogador})`);
    console.log(`🔍 Validação antes de enviar: jogoAtivo=${jogoEstaAtivo}, turnoAtual=${turnoAtual}, meuNumero=${meuNumeroJogador}, letraChutada=${letrasChutadas.has(letra)}`);
    
    enviarEvento({
        tipo: 'jogada',
        letra: letra
    });
}

// --- 7. ATUALIZAÇÃO DE UI ---
function atualizarVidasUI() {
    console.log(`💚 Atualizando vidas: J1=${vidas[0]}, J2=${vidas[1]}`);
    
    // Atualiza vidas do jogador 1
    if (vidasP1Container) {
        vidasP1Container.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const vida = document.createElement('span');
            vida.className = 'vida';
            if (i < vidas[0]) {
                vida.style.backgroundColor = '#00bcd4';
            } else {
                vida.style.backgroundColor = '#555';
                vida.style.opacity = '0.3';
            }
            vidasP1Container.appendChild(vida);
        }
    }
    
    // Atualiza vidas do jogador 2
    if (vidasP2Container) {
        vidasP2Container.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const vida = document.createElement('span');
            vida.className = 'vida';
            if (i < vidas[1]) {
                vida.style.backgroundColor = '#00bcd4';
            } else {
                vida.style.backgroundColor = '#555';
                vida.style.opacity = '0.3';
            }
            vidasP2Container.appendChild(vida);
        }
    }
}

function atualizarPalavraExibida() {
    // Determina qual palavra mostrar para cada jogador
    let minhaPalavra = palavraExibida || gerarPalavraOculta();
    let palavraAdv = palavraAdversarioExibida || '';
    
    console.log(`📝 Atualizando palavras: Minha="${minhaPalavra}", Adversário="${palavraAdv}"`);
    
    // Se sou jogador 1, minha palavra vai na primeira posição
    if (meuNumeroJogador === 1) {
        if (palavraP1_El) {
            palavraP1_El.textContent = minhaPalavra;
        }
        if (palavraP2_El) {
            palavraP2_El.textContent = palavraAdv || gerarPalavraOcultaAdversario();
        }
    } else {
        // Se sou jogador 2, minha palavra vai na segunda posição
        if (palavraP1_El) {
            palavraP1_El.textContent = palavraAdv || gerarPalavraOcultaAdversario();
        }
        if (palavraP2_El) {
            palavraP2_El.textContent = minhaPalavra;
        }
    }
}

function gerarPalavraOcultaAdversario() {
    // Gera palavra oculta genérica para o adversário (não sabemos o tamanho)
    return '_ _ _ _ _ _ _';
}

function gerarPalavraOculta() {
    if (!palavraSecreta) return '';
    return palavraSecreta.split('').map(l => l === ' ' ? '  ' : '_ ').join('').trim();
}

function atualizarBonecosUI() {
    // Cada jogador tem sua própria imagem baseada em seus próprios erros
    const indiceP1 = Math.min(errosJogador1 + 1, 7); // +1 porque as imagens começam em bob1.png
    const indiceP2 = Math.min(errosJogador2 + 1, 7); // +1 porque as imagens começam em patrick1.png
    
    if (bonecoP1_El) {
        bonecoP1_El.src = `/public/assets/images/bob${indiceP1}.png`;
    }
    if (bonecoP2_El) {
        bonecoP2_El.src = `/public/assets/images/patrick${indiceP2}.png`;
    }
    
    console.log(`🖼️ Bonecos atualizados: J1 (${errosJogador1} erros) -> bob${indiceP1}.png, J2 (${errosJogador2} erros) -> patrick${indiceP2}.png`);
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
    // Desabilita todas as letras já chutadas E quando não é o turno do jogador
    if (!tecladoContainer) {
        console.warn('⚠️ tecladoContainer não encontrado!');
        return;
    }
    
    // Garante que os valores são números válidos
    const turnoAtualNum = Number(turnoAtual) || 0;
    const meuNumeroNum = Number(meuNumeroJogador) || 0;
    
    const eMeuTurno = turnoAtualNum === meuNumeroNum && jogoEstaAtivo && meuNumeroNum > 0;
    
    console.log(`🔒 Atualizando teclado: eMeuTurno=${eMeuTurno}, turnoAtual=${turnoAtualNum} (${typeof turnoAtual}), meuNumero=${meuNumeroNum} (${typeof meuNumeroJogador}), jogoAtivo=${jogoEstaAtivo}`);
    
    if (!eMeuTurno) {
        console.log(`🔒 Bloqueando teclado: não é meu turno ou jogo não está ativo`);
    }
    
    tecladoContainer.querySelectorAll('.tecla').forEach(btn => {
        const letra = btn.textContent;
        const letraJaChutada = letrasChutadas.has(letra);
        
        // Desabilita se: letra já foi chutada OU não é o turno do jogador
        if (letraJaChutada || !eMeuTurno) {
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

        // Verificação crítica: jogo foi inicializado?
        if (!meuNumeroJogador || meuNumeroJogador === 0 || (meuNumeroJogador !== 1 && meuNumeroJogador !== 2)) {
            e.preventDefault();
            e.stopPropagation();
            console.warn('⚠️ Tentativa de chute antes do jogo ser inicializado! meuNumeroJogador:', meuNumeroJogador);
            mostrarFeedback('Aguarde o jogo iniciar...', 'orange');
            return false;
        }

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
        
        // Verifica se é o turno do jogador (usando comparação numérica)
        const turnoAtualNum = Number(turnoAtual) || 0;
        const meuNumeroNum = Number(meuNumeroJogador) || 0;
        
        if (turnoAtualNum !== meuNumeroNum || meuNumeroNum === 0) {
            e.preventDefault();
            e.stopPropagation();
            console.warn(`⚠️ Tentativa de chute fora do turno: turnoAtual=${turnoAtualNum}, meuNumero=${meuNumeroNum}`);
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
    // Primeiro verifica se é uma letra (A-Z), hífen (-) ou cedilha (Ç) - se não for, não faz nada e permite o comportamento padrão
    let letra = e.key.toUpperCase();
    
    // Trata cedilha minúscula
    if (e.key === 'ç' || e.key === 'Ç') {
        letra = 'Ç';
    }
    
    // Aceita A-Z, hífen (-) e cedilha (Ç)
    const letrasValidas = /^[A-Z\-Ç]$/;
    if (!(letra.length === 1 && letrasValidas.test(letra))) {
        // Não é uma letra válida, permite comportamento padrão (F12, Escape, etc.)
        return;
    }

    // A partir daqui, só processa letras (A-Z)
    // Verificação crítica: jogo foi inicializado?
    if (!meuNumeroJogador || meuNumeroJogador === 0 || (meuNumeroJogador !== 1 && meuNumeroJogador !== 2)) {
        e.preventDefault();
        console.warn('⚠️ Tentativa de chute (teclado físico) antes do jogo ser inicializado! meuNumeroJogador:', meuNumeroJogador);
        mostrarFeedback('Aguarde o jogo iniciar...', 'orange');
        return false;
    }

    if (!tecladoContainer) {
        e.preventDefault();
        return false;
    }

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
    
    // Verifica se é o turno do jogador (usando comparação numérica)
    const turnoAtualNum = Number(turnoAtual) || 0;
    const meuNumeroNum = Number(meuNumeroJogador) || 0;
    
    if (turnoAtualNum !== meuNumeroNum || meuNumeroNum === 0) {
        e.preventDefault();
        console.warn(`⚠️ Tentativa de chute (teclado físico) fora do turno: turnoAtual=${turnoAtualNum}, meuNumero=${meuNumeroNum}`);
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
