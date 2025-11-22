// game.js - Versão Socket.io para Jogo Multiplayer

import { conectarSocket, aoReceberEvento, enviarEvento, getMeuSocketId, getSocket } from './socket.js';

// --- 0. OTIMIZAÇÕES DE PERFORMANCE ---
// Sistema de logging condicional (desabilitado em produção)
const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const log = DEBUG ? console.log.bind(console) : () => {};
const logWarn = DEBUG ? console.warn.bind(console) : () => {};
const logError = console.error.bind(console); // Erros sempre logados

// Debounce para funções de atualização UI
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle para funções que precisam ser executadas periodicamente
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// --- 1. SELETORES DO DOM ---
const categoriaEl = document.querySelector('.categoria');
const timerEl = document.querySelector('.tempo');
const palavraP1_El = document.querySelector('.palavras .palavra-container:nth-child(1) .palavra');
const palavraP2_El = document.querySelector('.palavras .palavra-container:nth-child(2) .palavra');
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
let timerChutePalavra = null; // Timer específico para o modal de chute de palavra
let segundosRestantesRodada = 15; // Armazena os segundos restantes do timer da rodada
let timerRodadaPausado = false; // Indica se o timer da rodada está pausado
let chutePalavraDisponivel = true; // Indica se o jogador pode chutar palavra nesta rodada
let timerReconexao = null; // Timer para contador de reconexão
let sala = '';
let categoria = '';
let nomeJogador = '';
let instanceId = '';
let estaNoModoPreparacao = true;
let usuarioPronto = false;
const jogadoresProntos = new Set();
let poderesSelecionados = new Set(); // Set com os nomes dos poderes selecionados (ex: "liberar_letra", "vida_extra")
const MAX_PODERES = 3;
let poderesDisponiveis = []; // Array com os poderes selecionados que podem ser usados no jogo
let poderesUsados = new Set(); // Set com os poderes que já foram usados (não podem ser usados novamente)
let poderesUsadosNoTurno = new Set(); // Rastreia quais poderes foram usados no turno atual
let dicas = []; // Array com as dicas da palavra (ordem 1, 2, 3)
let dicaAtualExibida = 0; // Contador de qual dica está sendo exibida (0 = nenhuma, 1-3 = dica 1-3)

// Variáveis de aposta
let saldoMoedas = 0;
let minhaAposta = 0;
let apostaAdversario = null;

// Mapeamento de nomes de poderes para nomes de imagens e descrições
const MAPEAMENTO_PODERES = {
    'liberar_letra': {
        imagem: '/public/assets/images/liberar_letra.png',
        nome: 'Liberar Letra',
        descricao: 'Revela uma letra da palavra'
    },
    'ocultar_dica': {
        imagem: '/public/assets/images/ocultar_dica.png',
        nome: 'Ocultar Dica',
        descricao: 'Oculta a dica do adversário'
    },
    'ocultar_letra': {
        imagem: '/public/assets/images/ocultar_letra.png',
        nome: 'Ocultar Letra',
        descricao: 'Oculta uma letra da palavra do adversário'
    },
    'tirar_vida': {
        imagem: '/public/assets/images/Tirar_vida.png',
        nome: 'Tirar Vida',
        descricao: 'Tira uma vida do adversário'
    },
    'vida_extra': {
        imagem: '/public/assets/images/vida_extra.png',
        nome: 'Vida Extra',
        descricao: 'Ganha uma vida extra'
    },
    'palpite': {
        imagem: '/public/assets/images/palpite.png',
        nome: 'Palpite',
        descricao: 'Faz um palpite sobre a palavra'
    }
};

// --- 3. INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    log('🎮 DOMContentLoaded - Inicializando jogo...');
    
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
        log(`👤 Nome do jogador: ${nomeJogador}, ID: ${meuPlayerId}`);
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
    log(`🔌 Conectando ao socket: sala=${sala}, nome=${nomeJogador}, playerId=${meuPlayerId}, categoria=${categoria}`);
    conectarSocket(sala, nomeJogador, meuPlayerId, categoria);
    
    // Reconfigura listeners após conexão para garantir que estão ativos
    setTimeout(() => {
        configurarListenersSocket();
        log(`✅ Listeners de socket reconfigurados após conexão`);
    }, 200);
    
    // Aguarda um pouco para garantir que o socket está conectado
    setTimeout(() => {
        log('⏳ Aguardando evento de início do jogo...');
    }, 500);
    
    // Configura teclado virtual e físico
    configurarTecladoVirtual();
    document.addEventListener('keydown', lidarComChuteDeTecladoFisico);
    
    // Configura botão de chutar palavra completa
    configurarChutePalavra();
    
    // Configura botão de dica
    configurarBotaoDica();
    
    log('✅ Inicialização completa');
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
    
    // Configura sistema de apostas
    configurarApostas();

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

// Carrega saldo de moedas
async function carregarSaldoMoedas() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/players/moedas', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            saldoMoedas = data.moedas || 0;
            const saldoEl = document.getElementById('saldo-moedas-prep');
            if (saldoEl) {
                saldoEl.textContent = saldoMoedas;
            }
        } else {
            console.error('Erro ao carregar saldo de moedas');
            saldoMoedas = 0;
        }
    } catch (error) {
        console.error('Erro ao carregar saldo:', error);
        saldoMoedas = 0;
    }
}

// Configura interface de apostas
function configurarApostas() {
    const inputAposta = document.getElementById('input-aposta-prep');
    const mensagemAposta = document.getElementById('aposta-mensagem-prep');
    const apostaAdversarioEl = document.getElementById('aposta-adversario-prep');
    const botoesRapidos = document.querySelectorAll('.btn-aposta-quick-prep');
    
    if (!inputAposta || !mensagemAposta) {
        console.warn('Elementos de aposta não encontrados');
        return;
    }
    
    // Atualiza mensagem de aposta
    function atualizarMensagemAposta() {
        const valor = parseInt(inputAposta.value) || 0;
        if (valor > saldoMoedas) {
            mensagemAposta.textContent = `❌ Você não tem moedas suficientes!`;
            mensagemAposta.style.color = '#ff6b6b';
            inputAposta.value = saldoMoedas;
            minhaAposta = saldoMoedas;
        } else if (valor < 0) {
            mensagemAposta.textContent = `❌ Valor inválido!`;
            mensagemAposta.style.color = '#ff6b6b';
            inputAposta.value = 0;
            minhaAposta = 0;
        } else {
            minhaAposta = valor;
            mensagemAposta.textContent = `Aposta: ${valor} moedas`;
            mensagemAposta.style.color = '#e9fbff';
        }
        
        // Envia aposta ao servidor
        enviarEvento({
            tipo: 'definirAposta',
            valor: minhaAposta
        });
    }
    
    // Listener para input manual
    inputAposta.addEventListener('input', atualizarMensagemAposta);
    inputAposta.addEventListener('blur', atualizarMensagemAposta);
    
    // Botões rápidos
    botoesRapidos.forEach(btn => {
        btn.addEventListener('click', () => {
            const valorAdicionar = parseInt(btn.getAttribute('data-value'));
            const valorAtual = parseInt(inputAposta.value) || 0;
            const novoValor = Math.min(valorAtual + valorAdicionar, saldoMoedas);
            inputAposta.value = novoValor;
            atualizarMensagemAposta();
        });
    });
    
    // Carrega saldo
    carregarSaldoMoedas().then(() => {
        atualizarMensagemAposta();
    });
}

async function configurarSelecaoPoderes() {
    const containerPoderes = document.getElementById('poderes-container-atual');
    if (!containerPoderes) {
        console.error(`[${instanceId}] ❌ Container de poderes não encontrado!`);
        return;
    }
    
    // Limpa o container
    containerPoderes.innerHTML = '';
    
    // Carrega o inventário do usuário
    const token = localStorage.getItem('token');
    if (!token) {
        console.error(`[${instanceId}] ❌ Token não encontrado!`);
        return;
    }
    
    try {
        const response = await fetch('/api/players/inventario', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro ao carregar inventário: ${response.status}`);
        }
        
        const inventario = await response.json();
        
        // Cria um mapa do inventário por tipo_poder para acesso rápido
        const inventarioMap = {};
        inventario.forEach(item => {
            if (item.tipo_poder && item.quantidade > 0) {
                inventarioMap[item.tipo_poder] = item.quantidade;
            }
        });
        
        // Cria botões para TODOS os poderes disponíveis
        Object.keys(MAPEAMENTO_PODERES).forEach(tipoPoder => {
            const poderInfo = MAPEAMENTO_PODERES[tipoPoder];
            const quantidade = inventarioMap[tipoPoder] || 0;
            const temPoder = quantidade > 0;
            
            const botaoPoder = document.createElement('button');
            botaoPoder.className = 'poder';
            botaoPoder.setAttribute('data-poder', tipoPoder);
            botaoPoder.setAttribute('data-quantidade', quantidade);
            botaoPoder.setAttribute('aria-label', poderInfo.nome);
            botaoPoder.disabled = !temPoder; // Desabilita se não tiver o poder
            
            // Adiciona classe para poderes sem estoque
            if (!temPoder) {
                botaoPoder.classList.add('sem-estoque');
            }
            
            // Container para imagem e contador
            const containerImg = document.createElement('div');
            containerImg.className = 'poder-img-container';
            containerImg.style.cssText = `
                position: relative;
                display: block;
                width: 100%;
                height: 100%;
            `;
            
            const imgPoder = document.createElement('img');
            imgPoder.src = poderInfo.imagem;
            imgPoder.alt = poderInfo.nome;
            imgPoder.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: contain;
                padding: 8px;
            `;
            
            // Badge com quantidade (só mostra se tiver o poder)
            if (temPoder) {
                const badgeQuantidade = document.createElement('span');
                badgeQuantidade.className = 'badge-quantidade-poder';
                badgeQuantidade.textContent = quantidade;
                containerImg.appendChild(badgeQuantidade);
            }
            
            containerImg.appendChild(imgPoder);
            botaoPoder.appendChild(containerImg);
            
            // Adiciona listener apenas se tiver o poder
            if (temPoder) {
                botaoPoder.addEventListener('click', lidarComCliquePoder);
            }
            
            containerPoderes.appendChild(botaoPoder);
        });
        
        console.log(`[${instanceId}] ✅ Poderes carregados. ${Object.keys(inventarioMap).length} tipos no inventário`);
    } catch (error) {
        console.error(`[${instanceId}] ❌ Erro ao carregar inventário:`, error);
        containerPoderes.innerHTML = '<p style="color: #ff6b6b; text-align: center; padding: 20px;">Erro ao carregar poderes. Recarregue a página.</p>';
    }
}

function lidarComCliquePoder(e) {
    const botao = e.currentTarget;
    const poderId = botao.getAttribute('data-poder');
    const quantidade = parseInt(botao.getAttribute('data-quantidade')) || 0;
    
    if (!poderId) {
        console.warn(`⚠️ Botão de poder sem data-poder:`, botao);
        return;
    }
    
    // Verifica se ainda tem quantidade disponível
    if (quantidade <= 0) {
        mostrarFeedback('Você não possui mais este poder!', 'orange');
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

// Função para renderizar os poderes selecionados na tela de jogo
function renderizarPoderesNoJogo() {
    const containerPoderes = document.getElementById('poderes-jogador-container');
    if (!containerPoderes) {
        console.error(`[${instanceId}] ❌ Container de poderes não encontrado!`);
        return;
    }
    
    // Limpa o container
    containerPoderes.innerHTML = '';
    
    if (poderesDisponiveis.length === 0) {
        console.log(`[${instanceId}] ℹ️ Nenhum poder selecionado para exibir`);
        return;
    }
    
    // Cria um botão para cada poder disponível
    poderesDisponiveis.forEach(poderId => {
        const poderInfo = MAPEAMENTO_PODERES[poderId];
        if (!poderInfo) {
            console.warn(`[${instanceId}] ⚠️ Poder desconhecido: ${poderId}`);
            return;
        }
        
        const botaoPoder = document.createElement('button');
        botaoPoder.className = 'poder';
        botaoPoder.setAttribute('data-poder', poderId);
        botaoPoder.setAttribute('title', poderInfo.descricao || poderInfo.nome);
        
        // Inicialmente habilita todos os poderes (será ajustado por reabilitarPoderesNoTurno)
        // Desabilita apenas se já foi usado permanentemente
        const jaFoiUsado = poderesUsados.has(poderId);
        
        // Inicialmente desabilita apenas se foi usado permanentemente
        // A função reabilitarPoderesNoTurno() será chamada depois para ajustar baseado no turno
        botaoPoder.disabled = jaFoiUsado;
        
        const imgPoder = document.createElement('img');
        imgPoder.src = poderInfo.imagem;
        imgPoder.alt = poderInfo.nome;
        
        botaoPoder.appendChild(imgPoder);
        
        // Adiciona classe se já foi usado
        if (jaFoiUsado) {
            botaoPoder.classList.add('usado');
            botaoPoder.style.pointerEvents = 'none';
            // Remove estilos inline para permitir que o CSS controle a aparência
            botaoPoder.style.opacity = '';
            botaoPoder.style.cursor = '';
            botaoPoder.style.filter = '';
            botaoPoder.style.transform = '';
        } else {
            // Inicialmente habilita visualmente (será ajustado por reabilitarPoderesNoTurno)
            // Remove estilos inline para permitir que o CSS controle a aparência
            botaoPoder.style.opacity = '';
            botaoPoder.style.cursor = '';
            botaoPoder.style.filter = '';
            botaoPoder.style.transform = '';
            
            // Adiciona listener para usar o poder apenas se não foi usado permanentemente
            botaoPoder.addEventListener('click', () => usarPoder(poderId, botaoPoder));
        }
        
        containerPoderes.appendChild(botaoPoder);
    });
    
    // Atualiza contador de poderes
    atualizarContadorPoderesDisplay();
    
    console.log(`[${instanceId}] ✅ ${poderesDisponiveis.length} poderes renderizados na tela de jogo`);
}

// Atualiza o contador de poderes na tela de jogo
function atualizarContadorPoderesDisplay() {
    const contadorEl = document.getElementById('poderes-contador-display');
    if (contadorEl) {
        const disponiveis = poderesDisponiveis.length;
        const usados = poderesUsados.size;
        contadorEl.textContent = `${usados}/${disponiveis}`;
        contadorEl.style.color = usados === disponiveis ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.7)';
    }
}

// Desabilita apenas o poder que foi usado (os outros continuam disponíveis)
function desabilitarPoderUsado(poderIdUsado) {
    const containerPoderes = document.getElementById('poderes-jogador-container');
    if (!containerPoderes) return;
    
    const botaoPoder = containerPoderes.querySelector(`.poder[data-poder="${poderIdUsado}"]`);
    if (!botaoPoder) return;
    
    // O poder usado é desabilitado (permanentemente se quantidade = 0, ou apenas neste turno)
    botaoPoder.disabled = true;
    botaoPoder.style.pointerEvents = 'none'; // Impede cliques
    // Remove estilos inline para permitir que o CSS controle a aparência
    botaoPoder.style.opacity = '';
    botaoPoder.style.cursor = '';
    botaoPoder.style.filter = '';
    botaoPoder.style.transform = '';
    
    if (poderesUsados.has(poderIdUsado)) {
        // Se foi usado permanentemente, adiciona classe 'usado' e remove 'desabilitado-turno'
        botaoPoder.classList.add('usado');
        botaoPoder.classList.remove('desabilitado-turno');
        console.log(`[${instanceId}] 🔴 Poder ${poderIdUsado} USADO PERMANENTEMENTE (quantidade = 0)`);
    } else {
        // Se não foi usado permanentemente, apenas desabilita para este turno
        botaoPoder.classList.add('desabilitado-turno');
        botaoPoder.classList.remove('usado'); // Remove classe 'usado' se ainda pode ser usado depois
        console.log(`[${instanceId}] 🟡 Poder ${poderIdUsado} DESABILITADO NO TURNO (foi usado)`);
    }
    // Força reflow para garantir que o CSS seja aplicado
    botaoPoder.offsetHeight;
}

// Reabilita poderes quando o turno troca (exceto os já usados permanentemente)
let ultimoTurnoReabilitado = null;

function reabilitarPoderesNoTurno() {
    const containerPoderes = document.getElementById('poderes-jogador-container');
    if (!containerPoderes) {
        log(`⚠️ Container de poderes não encontrado!`);
        return;
    }
    
    // Verifica se os valores estão definidos
    if (meuNumeroJogador === null || turnoAtual === null) {
        log(`⚠️ Valores não definidos ainda: meuNumeroJogador=${meuNumeroJogador}, turnoAtual=${turnoAtual}`);
        return;
    }
    
    const eMeuTurno = turnoAtual === meuNumeroJogador && jogoEstaAtivo;
    
    log(`🔍 reabilitarPoderesNoTurno: turnoAtual=${turnoAtual}, meuNumeroJogador=${meuNumeroJogador}, jogoEstaAtivo=${jogoEstaAtivo}, eMeuTurno=${eMeuTurno}, ultimoTurnoReabilitado=${ultimoTurnoReabilitado}, poderesUsadosNoTurno=${Array.from(poderesUsadosNoTurno).join(', ')}`);
    
    // Se o turno mudou para o meu turno, reseta os poderes usados no turno
    // Isso garante que quando o turno volta para o jogador, os poderes são liberados
    if (eMeuTurno && ultimoTurnoReabilitado !== turnoAtual) {
        // Turno mudou para o meu turno - reseta poderes usados no turno
        // Isso libera os poderes que não foram usados permanentemente
        poderesUsadosNoTurno.clear();
        ultimoTurnoReabilitado = turnoAtual;
        log(`🔄 Turno voltou para mim! Resetando poderes usados no turno. Liberando poderes não usados.`);
    }
    
    // Se é o primeiro turno do jogo e ainda não foi reabilitado, reseta
    if (ultimoTurnoReabilitado === null && eMeuTurno) {
        poderesUsadosNoTurno.clear();
        ultimoTurnoReabilitado = turnoAtual;
        log(`🔄 Primeiro turno do jogo! Habilitando poderes.`);
    }
    
    const botoesPoderes = containerPoderes.querySelectorAll('.poder');
    log(`🔍 Encontrados ${botoesPoderes.length} botões de poderes`);
    
    botoesPoderes.forEach(botao => {
        const poderId = botao.getAttribute('data-poder');
        const jaFoiUsadoPermanentemente = poderesUsados.has(poderId);
        const foiUsadoNesteTurno = poderesUsadosNoTurno.has(poderId);
        
        // Se é meu turno e o poder não foi usado permanentemente E não foi usado neste turno, habilita
        if (!jaFoiUsadoPermanentemente && !foiUsadoNesteTurno && eMeuTurno) {
            // Remove classes de desabilitado do turno anterior
            botao.classList.remove('desabilitado-turno', 'usado');
            botao.disabled = false;
            botao.style.pointerEvents = '';
            // Remove estilos inline para permitir que o CSS controle a aparência
            botao.style.opacity = '';
            botao.style.cursor = '';
            botao.style.filter = '';
            botao.style.transform = '';
            log(`✅ Poder ${poderId} HABILITADO (é meu turno, não foi usado permanentemente e não foi usado neste turno)`);
        } else if (jaFoiUsadoPermanentemente) {
            // Poder foi usado permanentemente (quantidade = 0)
            botao.disabled = true;
            botao.style.pointerEvents = 'none';
            // Remove estilos inline para permitir que o CSS controle a aparência
            botao.style.opacity = '';
            botao.style.cursor = '';
            botao.style.filter = '';
            botao.style.transform = '';
            botao.classList.add('usado');
            botao.classList.remove('desabilitado-turno');
            log(`❌ Poder ${poderId} DESABILITADO (já foi usado permanentemente - quantidade = 0)`);
        } else if (foiUsadoNesteTurno && !jaFoiUsadoPermanentemente) {
            // Este poder foi usado neste turno - desabilita apenas este
            botao.disabled = true;
            botao.style.pointerEvents = 'none';
            botao.classList.add('desabilitado-turno');
            botao.classList.remove('usado');
            // Remove estilos inline para permitir que o CSS controle a aparência
            botao.style.opacity = '';
            botao.style.cursor = '';
            botao.style.filter = '';
            botao.style.transform = '';
            log(`❌ Poder ${poderId} DESABILITADO (foi usado neste turno)`);
        } else if (!eMeuTurno) {
            // Não é meu turno
            botao.disabled = true;
            botao.style.pointerEvents = 'none';
            botao.classList.add('desabilitado-turno');
            // Remove estilos inline para permitir que o CSS controle a aparência
            botao.style.opacity = '';
            botao.style.cursor = '';
            botao.style.filter = '';
            botao.style.transform = '';
            log(`❌ Poder ${poderId} DESABILITADO (não é meu turno)`);
        }
    });
}

// Processa o resultado do uso de um poder
function processarResultadoPoder(resultado, evento) {
    console.log(`🎯 Processando resultado do poder:`, resultado);
    
    switch (resultado.tipo) {
        case 'vidaExtra':
            // Vida extra foi adicionada
            if (resultado.jogador === meuNumeroJogador) {
                mostrarFeedback('💚 Vida extra ganha!', 'green');
                // Vidas já foram atualizadas pelo evento
            }
            break;
            
        case 'tirarVida':
            // Erro foi adicionado à forca do adversário
            if (resultado.jogador === meuNumeroJogador) {
                mostrarFeedback(`⚔️ Erro adicionado à forca do adversário! (${resultado.errosAdversario} erros)`, 'green');
                if (resultado.adversarioPerdeuVida) {
                    mostrarFeedback('💥 Adversário perdeu uma vida por erro!', 'green');
                }
                // Atualiza erros do adversário
                if (resultado.alvo === 1) {
                    errosJogador1 = resultado.errosAdversario || errosJogador1;
                } else {
                    errosJogador2 = resultado.errosAdversario || errosJogador2;
                }
                atualizarBonecosUI();
            } else if (resultado.alvo === meuNumeroJogador) {
                mostrarFeedback(`❌ Erro adicionado à sua forca! (${resultado.errosAdversario} erros)`, 'red');
                if (resultado.adversarioPerdeuVida) {
                    mostrarFeedback('💔 Você perdeu uma vida!', 'red');
                }
                // Atualiza seus próprios erros
                if (meuNumeroJogador === 1) {
                    errosJogador1 = resultado.errosAdversario || errosJogador1;
                } else {
                    errosJogador2 = resultado.errosAdversario || errosJogador2;
                }
                atualizarBonecosUI();
            }
            // Vidas já foram atualizadas pelo evento se necessário
            break;
            
        case 'liberarLetra':
            // Letra foi revelada
            if (resultado.jogador === meuNumeroJogador && resultado.sucesso) {
                mostrarFeedback(`🔓 Letra '${resultado.letra}' revelada!`, 'green');
                // Atualiza a palavra se fornecida
                if (resultado.palavraAtualizada) {
                    palavraExibida = resultado.palavraAtualizada;
                    atualizarPalavraExibida();
                }
            }
            break;
            
        case 'ocultarLetra':
            // Letra foi ocultada do adversário
            if (resultado.jogador === meuNumeroJogador && resultado.sucesso) {
                mostrarFeedback(`🔒 Letra '${resultado.letra}' ocultada do adversário!`, 'green');
            } else if (resultado.alvo === meuNumeroJogador) {
                mostrarFeedback('🔒 Uma letra foi ocultada da sua palavra!', 'orange');
                // Atualiza a palavra se necessário
                if (resultado.palavraAtualizada) {
                    palavraExibida = resultado.palavraAtualizada;
                    atualizarPalavraExibida();
                }
            }
            break;
            
        case 'ocultarDica':
            if (resultado.jogador === meuNumeroJogador) {
                mostrarFeedback('🚫 Próxima dica do adversário será bloqueada!', 'green');
            } else if (resultado.adversario === meuNumeroJogador) {
                mostrarFeedback('🚫 Sua próxima dica foi bloqueada pelo poder "Ocultar Dica"!', 'orange');
            }
            break;
            
        case 'palpite':
            if (resultado.jogador === meuNumeroJogador) {
                mostrarFeedback('🎯 Palpite ativado! As próximas letras do adversário contarão como erro na sua forca!', 'green');
            }
            break;
            
        default:
            console.warn(`⚠️ Tipo de resultado de poder desconhecido: ${resultado.tipo}`);
    }
}

// Função para usar um poder durante o jogo
async function usarPoder(poderId, botaoElemento) {
    if (!jogoEstaAtivo) {
        console.warn(`[${instanceId}] ⚠️ Jogo não está ativo. Não é possível usar poderes.`);
        mostrarFeedback('O jogo não está ativo', 'orange');
        return;
    }
    
    // Verifica se o poder já foi usado permanentemente
    if (poderesUsados.has(poderId)) {
        console.warn(`[${instanceId}] ⚠️ Poder ${poderId} já foi usado permanentemente!`);
        mostrarFeedback('Este poder já foi usado!', 'orange');
        return;
    }
    
    // Verifica se este poder específico já foi usado neste turno
    if (poderesUsadosNoTurno.has(poderId)) {
        console.warn(`[${instanceId}] ⚠️ Este poder ${poderId} já foi usado neste turno!`);
        mostrarFeedback('Este poder já foi usado neste turno!', 'orange');
        return;
    }
    
    // Verifica se o poder está disponível
    if (!poderesDisponiveis.includes(poderId)) {
        console.warn(`[${instanceId}] ⚠️ Poder ${poderId} não está disponível!`);
        mostrarFeedback('Este poder não está disponível', 'orange');
        return;
    }
    
    // Verifica se é o turno do jogador (poderes só podem ser usados no próprio turno)
    if (turnoAtual !== meuNumeroJogador) {
        console.warn(`[${instanceId}] ⚠️ Não é seu turno! Turno atual: ${turnoAtual}, Seu número: ${meuNumeroJogador}`);
        mostrarFeedback('Você só pode usar poderes no seu turno!', 'orange');
        return;
    }
    
    console.log(`[${instanceId}] 🎯 Usando poder: ${poderId}`);
    
    // Subtrai do inventário no banco de dados
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const response = await fetch('/api/players/usar-poder', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tipoPoder: poderId
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Erro ao usar poder no inventário');
            }
            
            const data = await response.json();
            console.log(`[${instanceId}] ✅ Poder subtraído do inventário. Quantidade restante: ${data.quantidadeRestante}`);
            
            // Se a quantidade restante é 0, marca como usado permanentemente
            if (data.quantidadeRestante === 0) {
                poderesUsados.add(poderId);
                // Atualiza visualmente o botão imediatamente
                if (botaoElemento) {
                    botaoElemento.classList.add('usado');
                    botaoElemento.classList.remove('desabilitado-turno'); // Remove classe temporária
                    botaoElemento.disabled = true;
                    // Remove estilos inline para permitir que o CSS controle a aparência
                    botaoElemento.style.opacity = '';
                    botaoElemento.style.cursor = '';
                    botaoElemento.style.filter = '';
                    botaoElemento.style.transform = '';
                }
            }
        } catch (error) {
            console.error(`[${instanceId}] ❌ Erro ao subtrair poder do inventário:`, error);
            // Continua mesmo se houver erro (não bloqueia o uso do poder)
        }
    }
    
    // Marca que este poder foi usado neste turno (NÃO marca como usado permanentemente, a menos que quantidade = 0)
    poderesUsadosNoTurno.add(poderId);
    
    // Desabilita apenas o poder que foi usado (os outros continuam disponíveis)
    desabilitarPoderUsado(poderId);
    
    // Atualiza visualmente o botão IMEDIATAMENTE (desabilita para este turno)
    if (botaoElemento) {
        // Remove event listener para prevenir cliques múltiplos
        botaoElemento.removeEventListener('click', renderizarPoderesNoJogo);
        
        // Desabilita o botão
        botaoElemento.disabled = true;
        
        // Remove estilos inline que possam estar sobrescrevendo o CSS
        botaoElemento.style.opacity = '';
        botaoElemento.style.cursor = '';
        botaoElemento.style.filter = '';
        botaoElemento.style.transform = '';
        botaoElemento.style.pointerEvents = 'none';
        
        // Adiciona classes para estilização via CSS
        // Se foi usado permanentemente (quantidade = 0), adiciona classe 'usado' e remove 'desabilitado-turno'
        if (poderesUsados.has(poderId)) {
            botaoElemento.classList.add('usado');
            botaoElemento.classList.remove('desabilitado-turno'); // Remove classe temporária, mantém apenas 'usado'
            console.log(`[${instanceId}] 🔴 Poder ${poderId} marcado como USADO PERMANENTEMENTE`);
        } else {
            // Se não foi usado permanentemente, apenas desabilita para este turno
            botaoElemento.classList.add('desabilitado-turno');
            botaoElemento.classList.remove('usado'); // Garante que não tem classe 'usado' se ainda pode ser usado
            console.log(`[${instanceId}] 🟡 Poder ${poderId} marcado como DESABILITADO NO TURNO`);
        }
        
        // Força reflow para garantir que o CSS seja aplicado
        botaoElemento.offsetHeight;
    }
    
    // Atualiza contador de poderes
    atualizarContadorPoderesDisplay();
    
    // Envia evento ao servidor para processar o poder
    enviarEvento({
        tipo: 'usarPoder',
        poderId: poderId,
        jogador: meuNumeroJogador
    });
    
    const poderInfo = MAPEAMENTO_PODERES[poderId];
    mostrarFeedback(`${poderInfo?.nome || poderId} usado!`, 'green');
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
        poderes: poderesArray, // Envia array de poderes selecionados
        aposta: minhaAposta // Inclui a aposta
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
            
            // Reabilita poderes quando o turno troca
            reabilitarPoderesNoTurno();
            
            // Atualiza estado do botão de dica
            atualizarEstadoBotaoDica();
            
            // Limpa o timer anterior e inicia novo se for meu turno
            clearInterval(timerInterval);
            const turnoAtualNum = Number(turnoAtual) || 0;
            const meuNumeroNum = Number(meuNumeroJogador) || 0;
            
            // Se é meu turno agora, reabilita o botão de chute
            if (turnoAtualNum === meuNumeroNum && meuNumeroNum > 0 && jogoEstaAtivo) {
                console.log(`✓ É meu turno agora (jogador ${meuNumeroNum}), iniciando timer`);
                // Reabilita o botão de chute quando o turno volta para o jogador
                chutePalavraDisponivel = true;
                iniciarTimer();
            } else {
                console.log(`✗ Não é meu turno (jogador ${meuNumeroNum}, turno atual: ${turnoAtualNum})`);
                if (timerEl) {
                    timerEl.textContent = 'Aguardando...';
                    timerEl.style.color = '#888';
                }
            }
        } else if (evento.tipo === 'jogadorDesconectado') {
            console.log('⚠️ Jogador desconectado:', evento);
            const jogadorDesconectado = evento.jogadorDesconectado;
            const tempoReconexao = evento.tempoReconexao || 20;
            
            if (jogadorDesconectado !== meuNumeroJogador) {
                // Adversário desconectou
                mostrarFeedback(`⚠️ Adversário desconectou! Aguardando reconexão (${tempoReconexao}s)...`, 'orange');
                
                // Inicia contador visual de reconexão
                iniciarContadorReconexao(tempoReconexao);
            } else {
                // Eu desconectei (mas reconectei)
                mostrarFeedback('Você reconectou!', 'green');
            }
        } else if (evento.tipo === 'jogadorReconectado') {
            console.log('✅ Jogador reconectado:', evento);
            const jogadorReconectado = evento.jogadorReconectado;
            
            // Para o contador de reconexão
            pararContadorReconexao();
            
            if (jogadorReconectado !== meuNumeroJogador) {
                // Adversário reconectou
                mostrarFeedback('✅ Adversário reconectou!', 'green');
                
                // Retoma o timer normal se for meu turno
                if (turnoAtual === meuNumeroJogador && jogoEstaAtivo) {
                    iniciarTimer();
                } else if (timerEl) {
                    timerEl.textContent = 'Aguardando...';
                    timerEl.style.color = '#888';
                }
            } else {
                // Eu reconectei
                mostrarFeedback('✅ Você reconectou!', 'green');
                
                // Retoma o timer se for meu turno
                if (turnoAtual === meuNumeroJogador && jogoEstaAtivo) {
                    iniciarTimer();
                } else if (timerEl) {
                    timerEl.textContent = 'Aguardando...';
                    timerEl.style.color = '#888';
                }
            }
        } else if (evento.tipo === 'fim') {
            console.log('🏆 Evento FIM recebido:', evento);
            const vencedor = evento.vencedor;
            
            // Para o contador de reconexão se estiver rodando
            pararContadorReconexao();
            
            if (vencedor === meuNumeroJogador) {
                if (evento.motivo === 'wo') {
                    mostrarFeedback('🏆 Você venceu por W.O.! Adversário desconectou.', 'green');
                }
                finalizarJogo('vitoria');
            } else {
                if (evento.motivo === 'wo') {
                    mostrarFeedback('❌ Você perdeu por W.O.! Você desconectou.', 'red');
                }
                finalizarJogo('derrota');
            }
        } else if (evento.tipo === 'preparacao') {
            console.log('⏳ Evento PREPARACAO recebido - aguardando ambos estarem prontos...');
            console.log('📦 Dados do evento preparacao:', JSON.stringify(evento, null, 2));
            ativarModoPreparacao(evento);
        } else if (evento.tipo === 'pronto') {
            console.log('✅ Evento PRONTO recebido na tela unificada:', evento);
            
            // Atualiza aposta do adversário se fornecida
            if (evento.aposta !== undefined && evento.nome !== nomeJogador) {
                apostaAdversario = evento.aposta;
                const apostaAdversarioEl = document.getElementById('aposta-adversario-prep');
                if (apostaAdversarioEl) {
                    if (evento.aposta > 0) {
                        apostaAdversarioEl.textContent = `Adversário apostou: ${evento.aposta} moedas`;
                        apostaAdversarioEl.style.color = '#00e5ff';
                    } else {
                        apostaAdversarioEl.textContent = `Adversário não apostou`;
                        apostaAdversarioEl.style.color = '#888';
                    }
                }
            }
            registrarEventoPronto(evento);
        } else if (evento.tipo === 'poderUsado') {
            console.log('✅ Poder usado com sucesso:', evento);
            
            // Se começou nova rodada, reseta completamente o estado
            if (evento.novaRodada) {
                console.log('🔄 Nova rodada iniciada após uso de poder');
                clearInterval(timerInterval);
                
                // Reseta letras chutadas e erros completamente
                letrasChutadas = new Set();
                errosJogador1 = 0;
                errosJogador2 = 0;
                
                // Reseta poder usado no turno (nova rodada = novo turno)
                // Isso permite que os poderes não usados sejam liberados
                poderesUsadosNoTurno.clear();
                ultimoTurnoReabilitado = null; // Força reabilitação no próximo turno
                
                // Atualiza palavras secretas se fornecidas
                if (evento.novaPalavraJogador1 && evento.novaPalavraJogador2) {
                    palavraSecreta = meuNumeroJogador === 1 ? evento.novaPalavraJogador1 : evento.novaPalavraJogador2;
                    palavraExibida = '';
                    palavraAdversarioExibida = '';
                    
                    // Reconstrói palavra exibida com underscores
                    for (let i = 0; i < palavraSecreta.length; i++) {
                        palavraExibida += palavraSecreta[i] === ' ' ? ' ' : '_';
                    }
                }
                
                // Atualiza dicas se fornecidas
                if (evento.dicasJogador1 && evento.dicasJogador2) {
                    dicas = meuNumeroJogador === 1 ? evento.dicasJogador1 : evento.dicasJogador2;
                    dicaAtualExibida = 0;
                    ocultarDica();
                }
                
                atualizarPalavraExibida();
                atualizarBonecosUI();
                atualizarTecladoDesabilitado();
            }
            
            // Se o poder mantém o turno, atualiza o turno para o jogador que usou
            if (evento.manterTurno && evento.turno) {
                turnoAtual = evento.turno;
                console.log(`🔄 Poder mantém turno: turno atualizado para ${turnoAtual}`);
                atualizarTurnoUI();
                atualizarTecladoDesabilitado();
                // Não reabilita poderes se o turno foi mantido
            } else {
                // Se o poder não mantém o turno, reabilita poderes quando o turno trocar
                // (será feito quando o evento turnoTrocado chegar)
            }
            
            // Processa o resultado do poder
            if (evento.resultado) {
                processarResultadoPoder(evento.resultado, evento);
            }
            
            // Atualiza vidas se fornecidas (com animação se for vida extra)
            if (evento.vidas) {
                const animar = evento.resultado?.tipo === 'vidaExtra';
                const jogador = evento.resultado?.jogador;
                vidas = evento.vidas;
                atualizarVidasUI(animar, jogador);
            }
            
            if (evento.poderId) {
                const poderInfo = MAPEAMENTO_PODERES[evento.poderId];
                const mensagem = evento.resultado?.mensagem || `${poderInfo?.nome || evento.poderId} usado com sucesso!`;
                mostrarFeedback(mensagem, evento.sucesso !== false ? 'green' : 'orange');
            }
            
            // Se começou nova rodada, inicia o timer se for o turno do jogador
            if (evento.novaRodada && evento.turno === meuNumeroJogador) {
                iniciarTimer();
            }
        } else if (evento.tipo === 'poderUsadoGlobal') {
            console.log('🌐 Poder usado globalmente:', evento);
            
            // Se começou nova rodada, reseta completamente o estado
            if (evento.novaRodada) {
                console.log('🔄 Nova rodada iniciada após uso de poder (global)');
                clearInterval(timerInterval);
                
                // Reseta letras chutadas e erros completamente
                letrasChutadas = new Set();
                errosJogador1 = 0;
                errosJogador2 = 0;
                
                // Atualiza palavras secretas se fornecidas
                if (evento.novaPalavraJogador1 && evento.novaPalavraJogador2) {
                    palavraSecreta = meuNumeroJogador === 1 ? evento.novaPalavraJogador1 : evento.novaPalavraJogador2;
                    palavraExibida = '';
                    palavraAdversarioExibida = '';
                    
                    // Reconstrói palavra exibida com underscores
                    for (let i = 0; i < palavraSecreta.length; i++) {
                        palavraExibida += palavraSecreta[i] === ' ' ? ' ' : '_';
                    }
                }
                
                // Atualiza dicas se fornecidas
                if (evento.dicasJogador1 && evento.dicasJogador2) {
                    dicas = meuNumeroJogador === 1 ? evento.dicasJogador1 : evento.dicasJogador2;
                    dicaAtualExibida = 0;
                    ocultarDica();
                }
                
                atualizarPalavraExibida();
                atualizarBonecosUI();
                atualizarTecladoDesabilitado();
            }
            
            // Atualiza vidas se necessário
            if (evento.atualizarVidas && evento.vidas) {
                vidas = evento.vidas;
                atualizarVidasUI(false, null); // Sem animação especial aqui
                
                // Mostra feedback se foi nosso poder ou do adversário
                if (evento.jogador === meuNumeroJogador) {
                    mostrarFeedback('Poder usado com sucesso!', 'green');
                } else {
                    mostrarFeedback('Adversário usou um poder!', 'orange');
                }
            }
            
            // Atualiza turno se fornecido
            if (evento.turno) {
                turnoAtual = evento.turno;
                atualizarTurnoUI();
                atualizarTecladoDesabilitado();
                reabilitarPoderesNoTurno();
                atualizarEstadoBotaoDica();
                
                // Inicia o timer se for o turno do jogador
                if (turnoAtual === meuNumeroJogador && jogoEstaAtivo) {
                    iniciarTimer();
                }
            }
        } else if (evento.tipo === 'adversarioUsouPoder') {
            console.log('⚠️ Adversário usou um poder:', evento);
            mostrarFeedback('Adversário usou um poder!', 'orange');
        } else if (evento.tipo === 'chutePalavra') {
            console.log('📥 Chute de palavra processado');
            console.log('📋 Detalhes do evento:', {
                resultado: evento.resultado,
                jogadorQueJogou: evento.jogadorQueJogou,
                meuNumeroJogador: meuNumeroJogador,
                vidas: evento.vidas,
                turno: evento.turno
            });
            
            // Atualiza o estado do jogo
            if (evento.palavraJogador1 && evento.palavraJogador2) {
                palavraExibida = evento.jogadorQueJogou === meuNumeroJogador 
                    ? (meuNumeroJogador === 1 ? evento.palavraJogador1 : evento.palavraJogador2)
                    : palavraExibida;
                palavraAdversarioExibida = evento.jogadorQueJogou === meuNumeroJogador
                    ? (meuNumeroJogador === 1 ? evento.palavraJogador2 : evento.palavraJogador1)
                    : palavraAdversarioExibida;
                atualizarPalavraExibida();
            }
            
            // Atualiza erros
            if (evento.errosJogador1 !== undefined && evento.errosJogador2 !== undefined) {
                errosJogador1 = evento.errosJogador1;
                errosJogador2 = evento.errosJogador2;
                atualizarBonecosUI();
            }
            
            // Atualiza vidas
            if (evento.vidas) {
                vidas = evento.vidas;
                atualizarVidasUI(false, null);
            }
            
            // Atualiza turno
            if (evento.turno) {
                turnoAtual = evento.turno;
                atualizarTurnoUI();
                atualizarTecladoDesabilitado();
                // Reabilita poderes quando o turno troca
                reabilitarPoderesNoTurno();
                // Atualiza estado do botão de dica quando o turno muda
                atualizarEstadoBotaoDica();
            }
            
            // Feedback baseado no resultado
            if (evento.jogadorQueJogou === meuNumeroJogador) {
                if (evento.resultado === 'vitoria') {
                    mostrarFeedback(`🎯 Você acertou a palavra "${evento.palavraChutada}"! Adversário perde uma vida!`, 'green');
                } else if (evento.resultado === 'derrota') {
                    mostrarFeedback(`❌ Você errou a palavra "${evento.palavraChutada}"! Você perde uma vida!`, 'red');
                } else {
                    console.warn('⚠️ Resultado desconhecido:', evento.resultado);
                    mostrarFeedback(`Chute processado: "${evento.palavraChutada}"`, 'orange');
                }
            } else {
                if (evento.resultado === 'vitoria') {
                    mostrarFeedback(`⚠️ Adversário acertou a palavra! Você perde uma vida!`, 'orange');
                } else if (evento.resultado === 'derrota') {
                    mostrarFeedback(`✅ Adversário errou a palavra!`, 'green');
                } else {
                    console.warn('⚠️ Resultado desconhecido:', evento.resultado);
                }
            }
            
            // Se começou nova rodada, reseta completamente o estado
            if (evento.novaRodada) {
                console.log('🔄 Nova rodada iniciada após chute de palavra');
                clearInterval(timerInterval);
                
                // Reseta letras chutadas e erros completamente
                letrasChutadas = new Set();
                errosJogador1 = 0;
                errosJogador2 = 0;
                
                // Reseta contador de dicas para nova rodada
                dicaAtualExibida = 0;
                ocultarDica();
                atualizarEstadoBotaoDica();
                
                // Reabilita o botão de chutar para a nova rodada
                chutePalavraDisponivel = true;
                
                // Reseta poder usado no turno (nova rodada = novo turno)
                // Isso permite que os poderes não usados sejam liberados
                poderesUsadosNoTurno.clear();
                ultimoTurnoReabilitado = null; // Força reabilitação no próximo turno
                
                // Se há novas palavras secretas, usa elas para criar a palavra exibida inicial
                if (evento.novaPalavraJogador1 && evento.novaPalavraJogador2) {
                    console.log(`📝 Novas palavras recebidas para nova rodada`);
                    // Atualiza palavra secreta local
                    if (meuNumeroJogador === 1) {
                        palavraSecreta = evento.novaPalavraJogador1;
                        // Cria palavra exibida inicial com underscores (nova rodada = palavra vazia)
                        let palavraInicial = '';
                        for (let i = 0; i < palavraSecreta.length; i++) {
                            palavraInicial += palavraSecreta[i] === ' ' ? '  ' : '_ ';
                        }
                        palavraExibida = palavraInicial.trim();
                        // Cria palavra adversário inicial com underscores
                        let palavraAdvInicial = '';
                        for (let i = 0; i < evento.novaPalavraJogador2.length; i++) {
                            palavraAdvInicial += evento.novaPalavraJogador2[i] === ' ' ? '  ' : '_ ';
                        }
                        palavraAdversarioExibida = palavraAdvInicial.trim();
                        // Atualiza dicas se fornecidas
                        if (evento.dicasJogador1) {
                            dicas = evento.dicasJogador1;
                            console.log(`💡 Novas dicas recebidas para J1: ${dicas.length} dicas disponíveis`);
                        }
                    } else {
                        palavraSecreta = evento.novaPalavraJogador2;
                        // Cria palavra exibida inicial com underscores (nova rodada = palavra vazia)
                        let palavraInicial = '';
                        for (let i = 0; i < palavraSecreta.length; i++) {
                            palavraInicial += palavraSecreta[i] === ' ' ? '  ' : '_ ';
                        }
                        palavraExibida = palavraInicial.trim();
                        // Cria palavra adversário inicial com underscores
                        let palavraAdvInicial = '';
                        for (let i = 0; i < evento.novaPalavraJogador1.length; i++) {
                            palavraAdvInicial += evento.novaPalavraJogador1[i] === ' ' ? '  ' : '_ ';
                        }
                        palavraAdversarioExibida = palavraAdvInicial.trim();
                        // Atualiza dicas se fornecidas
                        if (evento.dicasJogador2) {
                            dicas = evento.dicasJogador2;
                            console.log(`💡 Novas dicas recebidas para J2: ${dicas.length} dicas disponíveis`);
                        }
                    }
                } else {
                    // Fallback: usa as palavras exibidas do evento
                    if (meuNumeroJogador === 1) {
                        palavraExibida = evento.palavraJogador1 || palavraExibida;
                        palavraAdversarioExibida = evento.palavraJogador2 || palavraAdversarioExibida;
                    } else {
                        palavraExibida = evento.palavraJogador2 || palavraExibida;
                        palavraAdversarioExibida = evento.palavraJogador1 || palavraAdversarioExibida;
                    }
                }
                
                // Atualiza letras chutadas (deve estar vazio para nova rodada)
                letrasChutadas = new Set();
                
                // Atualiza UI imediatamente
                atualizarPalavraExibida();
                atualizarBonecosUI();
                atualizarTecladoDesabilitado();
                
                // Atualiza o estado do botão de chutar
                if (typeof atualizarEstadoBotaoChute === 'function') {
                    atualizarEstadoBotaoChute();
                }
                
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
            } else {
                // Se não é nova rodada, apenas atualiza o timer baseado no turno
                if (evento.turno === meuNumeroJogador && jogoEstaAtivo) {
                    // Reabilita o botão de chute quando o turno volta para o jogador
                    chutePalavraDisponivel = true;
                    // Reabilita poderes quando o turno volta para o jogador
                    reabilitarPoderesNoTurno();
                    iniciarTimer();
                } else {
                    clearInterval(timerInterval);
                    if (timerEl) {
                        timerEl.textContent = 'Aguardando...';
                        timerEl.style.color = '#888';
                    }
                    // Desabilita poderes quando não é meu turno
                    reabilitarPoderesNoTurno();
                }
            }
        } else if (evento.tipo === 'apostaAtualizada') {
            console.log('💰 Evento apostaAtualizada recebido:', evento);
            if (evento.jogador !== nomeJogador) {
                apostaAdversario = evento.valor;
                const apostaAdversarioEl = document.getElementById('aposta-adversario-prep');
                if (apostaAdversarioEl) {
                    if (evento.valor > 0) {
                        apostaAdversarioEl.textContent = `Adversário apostou: ${evento.valor} moedas`;
                        apostaAdversarioEl.style.color = '#00e5ff';
                    } else {
                        apostaAdversarioEl.textContent = `Adversário não apostou`;
                        apostaAdversarioEl.style.color = '#888';
                    }
                }
            }
        } else if (evento.tipo === 'erro') {
            console.warn('❌ Erro do servidor:', evento.mensagem);
            mostrarFeedback(evento.mensagem || 'Erro no servidor', 'red');
            // Se o erro for relacionado a poderes e o poder foi rejeitado, reabilita o botão
            if (evento.mensagem && (evento.mensagem.includes('poder') || evento.mensagem.includes('Poder'))) {
                const botoesPoder = document.querySelectorAll('#poderes-jogador-container .poder');
                botoesPoder.forEach(botao => {
                    const poderId = botao.getAttribute('data-poder');
                    // Se o servidor rejeitou, reseta o poder usado no turno
                    if (poderesUsadosNoTurno.has(poderId)) {
                        poderesUsadosNoTurno.delete(poderId);
                        botao.classList.remove('desabilitado-turno');
                        botao.disabled = false;
                        botao.style.pointerEvents = '';
                        botao.style.opacity = '';
                        botao.style.cursor = '';
                        // Reabilita todos os poderes
                        reabilitarPoderesNoTurno();
                    }
                });
            }
            // Se o erro for "não é seu turno", não faz nada além de mostrar feedback
            // O turno será atualizado quando o servidor enviar o próximo evento 'jogada'
        } else if (evento.tipo === 'dicaPedida') {
            console.log('💡 Evento dicaPedida recebido');
            console.log('💡 meuNumeroJogador:', meuNumeroJogador, 'jogadorQuePediu:', evento.jogadorQuePediu, 'bloqueada:', evento.bloqueada);
            
            // Se foi este jogador que pediu a dica
            if (evento.jogadorQuePediu === meuNumeroJogador) {
                // Incrementa o contador de dicas exibidas
                dicaAtualExibida = evento.ordemDica || dicaAtualExibida + 1;
                
                // Verifica se a dica foi bloqueada pelo poder "ocultar_dica"
                if (evento.bloqueada || !evento.textoDica || evento.textoDica.trim() === '') {
                    // Dica foi bloqueada - não exibe nada
                    console.log('🚫 Dica foi bloqueada pelo poder "ocultar_dica". Não será exibida.');
                    mostrarFeedback('🚫 Sua dica foi bloqueada pelo poder "Ocultar Dica"!', 'orange');
                } else {
                    // Dica não foi bloqueada - exibe normalmente
                    // Exibe a dica acima da palavra do jogador
                    const dicaId = meuNumeroJogador === 1 ? 'dica-palavra-jogador1' : 'dica-palavra-jogador2';
                    let dicaPalavraEl = document.getElementById(dicaId);
                    
                    // Se não encontrou pelo ID, tenta pelo seletor de classe
                    if (!dicaPalavraEl) {
                        const palavraContainer = meuNumeroJogador === 1 
                            ? document.querySelector('.palavras .palavra-container:nth-child(1)')
                            : document.querySelector('.palavras .palavra-container:nth-child(2)');
                        if (palavraContainer) {
                            dicaPalavraEl = palavraContainer.querySelector('.dica-palavra');
                        }
                    }
                    
                    console.log('💡 Tentando exibir dica:', {
                        dicaId: dicaId,
                        elementoEncontrado: !!dicaPalavraEl,
                        ordemDica: evento.ordemDica
                    });
                    
                    if (dicaPalavraEl && evento.textoDica) {
                        // Remove classe mostrar anterior se existir
                        dicaPalavraEl.classList.remove('mostrar');
                    
                    // Define o texto da dica
                    dicaPalavraEl.textContent = evento.textoDica;
                    
                    // Força a exibição imediatamente
                    dicaPalavraEl.style.opacity = '1';
                    dicaPalavraEl.style.visibility = 'visible';
                    dicaPalavraEl.style.transform = 'translateY(0)';
                    dicaPalavraEl.classList.add('mostrar');
                    
                        console.log(`💡 Dica ${dicaAtualExibida} exibida`);
                        console.log('💡 Classes do elemento:', dicaPalavraEl.className);
                        console.log('💡 Estilo do elemento:', {
                            opacity: window.getComputedStyle(dicaPalavraEl).opacity,
                            visibility: window.getComputedStyle(dicaPalavraEl).visibility,
                            display: window.getComputedStyle(dicaPalavraEl).display,
                            transform: window.getComputedStyle(dicaPalavraEl).transform
                        });
                        mostrarFeedback(`💡 Dica ${dicaAtualExibida} exibida! Você perdeu a vez.`, 'orange');
                    } else {
                        console.error('❌ Erro ao exibir dica:', {
                            elementoEncontrado: !!dicaPalavraEl,
                            temTextoDica: !!evento.textoDica,
                            dicaId: dicaId,
                            todosElementosDica: document.querySelectorAll('.dica-palavra').length
                        });
                        mostrarFeedback(`💡 Dica ${dicaAtualExibida} exibida! Você perdeu a vez.`, 'orange');
                    }
                }
            } else {
                // Se foi o outro jogador que pediu dica, mostra feedback
                mostrarFeedback('O adversário pediu uma dica!', 'orange');
            }
            
            // Atualiza o turno quando uma dica é pedida
            if (evento.turno) {
                turnoAtual = evento.turno;
                atualizarTurnoUI();
                atualizarTecladoDesabilitado();
                
                // Reabilita poderes quando o turno troca
                reabilitarPoderesNoTurno();
                
                // Atualiza estado do botão de dica
                atualizarEstadoBotaoDica();
                
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
            }
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
    dicas = dados.dicas || []; // Dicas da palavra (ordem 1, 2, 3)
    dicaAtualExibida = 0; // Reseta contador de dicas
    ocultarDica(); // Limpa dicas anteriores
    
    // Reseta poderes usados no turno quando inicia novo jogo
    poderesUsadosNoTurno.clear();
    ultimoTurnoReabilitado = null;
    
    console.log(`📝 Palavras recebidas para exibição`);
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
    
    // Se é uma reconexão, restaura o estado completo (erros e letras chutadas)
    if (dados.reconexao) {
        console.log(`🔄 Reconexão detectada! Restaurando estado completo do jogo...`);
        errosJogador1 = dados.errosJogador1 || 0;
        errosJogador2 = dados.errosJogador2 || 0;
        
        // Restaura letras chutadas
        letrasChutadas.clear();
        if (dados.letrasChutadasJogador1 && Array.isArray(dados.letrasChutadasJogador1)) {
            dados.letrasChutadasJogador1.forEach(letra => letrasChutadas.add(letra));
        }
        if (dados.letrasChutadasJogador2 && Array.isArray(dados.letrasChutadasJogador2)) {
            dados.letrasChutadasJogador2.forEach(letra => letrasChutadas.add(letra));
        }
        
        console.log(`✅ Estado restaurado: erros J1=${errosJogador1}, erros J2=${errosJogador2}, letras chutadas=${Array.from(letrasChutadas).join(', ')}`);
    } else {
        // Nova partida - reseta tudo
    errosJogador1 = 0;
    errosJogador2 = 0;
    letrasChutadas.clear();
    }
    
    categoriaEl.textContent = categoria;
    
    // Carrega os poderes selecionados que foram enviados pelo servidor
    poderesDisponiveis = dados.poderes || [];
    poderesUsados.clear(); // Reseta poderes usados
    poderesUsadosNoTurno.clear(); // Reseta poderes usados no turno
    ultimoTurnoReabilitado = null; // Reseta último turno reabilitado
    console.log(`🎯 Poderes disponíveis para o jogo:`, poderesDisponiveis);
    console.log(`🎯 Tipo de poderes:`, typeof poderesDisponiveis, Array.isArray(poderesDisponiveis));
    console.log(`🎯 Número de poderes:`, poderesDisponiveis.length);
    
    // Atualiza vidas UI antes de renderizar poderes
    atualizarVidasUI();
    
    // Renderiza os poderes na tela de jogo (com pequeno delay para garantir que o DOM está pronto)
    setTimeout(() => {
        renderizarPoderesNoJogo();
        // Garante que os poderes sejam habilitados corretamente após renderizar
        // Chama imediatamente e também após um pequeno delay para garantir que o turno está atualizado
        log(`🔍 Antes de reabilitar poderes: turnoAtual=${turnoAtual}, meuNumeroJogador=${meuNumeroJogador}, jogoEstaAtivo=${jogoEstaAtivo}`);
        reabilitarPoderesNoTurno();
        setTimeout(() => {
            log(`🔍 Após delay, reabilitando poderes: turnoAtual=${turnoAtual}, meuNumeroJogador=${meuNumeroJogador}, jogoEstaAtivo=${jogoEstaAtivo}`);
            reabilitarPoderesNoTurno();
        }, 200);
    }, 100);
    
    atualizarVidasUI();
    atualizarPalavraExibida();
    atualizarBonecosUI();
    atualizarTurnoUI();
    atualizarTecladoDesabilitado(); // Desabilita letras já chutadas E bloqueia se não for o turno
    atualizarEstadoBotaoDica(); // Atualiza estado do botão de dica
    
    // Garante que os poderes sejam habilitados após todas as atualizações
    setTimeout(() => {
        log(`🔍 Após todas as atualizações, reabilitando poderes: turnoAtual=${turnoAtual}, meuNumeroJogador=${meuNumeroJogador}, jogoEstaAtivo=${jogoEstaAtivo}`);
        reabilitarPoderesNoTurno();
    }, 300);
    
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
    
    const palpiteTransferido = Boolean(dados.palpiteTransferido);
    const palpiteBeneficiado = dados.palpiteBeneficiado || null;
    const letraPalpite = (dados.palpiteLetra || dados.letra || '').toUpperCase();

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
            clearInterval(timerInterval);
            
            // Reseta letras chutadas e erros completamente
            letrasChutadas = new Set();
            errosJogador1 = 0;
            errosJogador2 = 0;
            
            // Reseta contador de dicas para nova rodada
            dicaAtualExibida = 0;
            ocultarDica();
            atualizarEstadoBotaoDica();
            
            // Reseta poder usado no turno quando começa nova rodada
            poderesUsadosNoTurno.clear();
            ultimoTurnoReabilitado = null;
            
            // Se há novas palavras secretas, usa elas para criar a palavra exibida inicial
            if (dados.novaPalavraJogador1 && dados.novaPalavraJogador2) {
                console.log(`📝 Novas palavras recebidas para nova rodada`);
                // Atualiza palavra secreta local
                if (meuNumeroJogador === 1) {
                    palavraSecreta = dados.novaPalavraJogador1;
                    palavraExibida = dados.palavraJogador1 || '';
                    palavraAdversarioExibida = dados.palavraJogador2 || '';
                    // Atualiza dicas se fornecidas
                    if (dados.dicasJogador1) {
                        dicas = dados.dicasJogador1;
                        console.log(`💡 Novas dicas recebidas para J1: ${dicas.length} dicas disponíveis`);
                    }
                } else {
                    palavraSecreta = dados.novaPalavraJogador2;
                    palavraExibida = dados.palavraJogador2 || '';
                    palavraAdversarioExibida = dados.palavraJogador1 || '';
                    // Atualiza dicas se fornecidas
                    if (dados.dicasJogador2) {
                        dicas = dados.dicasJogador2;
                        console.log(`💡 Novas dicas recebidas para J2: ${dicas.length} dicas disponíveis`);
                    }
                }
            } else {
                // Usa as palavras exibidas do evento (fallback)
            if (meuNumeroJogador === 1) {
                palavraExibida = dados.palavraJogador1 || palavraExibida;
                palavraAdversarioExibida = dados.palavraJogador2 || palavraAdversarioExibida;
            } else {
                palavraExibida = dados.palavraJogador2 || palavraExibida;
                palavraAdversarioExibida = dados.palavraJogador1 || palavraAdversarioExibida;
            }
            }
            
            // Reseta letras chutadas (deve estar vazio para nova rodada)
            letrasChutadas = new Set();
            
            // Reabilita o botão de chutar para a nova rodada
            chutePalavraDisponivel = true;
            
            // Atualiza UI imediatamente
            atualizarPalavraExibida();
            atualizarBonecosUI();
            atualizarTecladoDesabilitado();
            
            // Reabilita poderes quando começa nova rodada
            reabilitarPoderesNoTurno();
            
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

    // Feedback específico do palpite
    if (palpiteTransferido) {
        if (palpiteBeneficiado === meuNumeroJogador) {
            if (dados.palpiteAcerto) {
                mostrarFeedback(`🎯 Seu palpite desviou a letra '${letraPalpite}' e ela revelou sua palavra!`, 'green');
            } else {
                mostrarFeedback(`🛡️ Seu palpite desviou a letra '${letraPalpite}'. Nenhum erro contabilizado e o turno voltou para você!`, 'orange');
            }
        } else if (dados.jogadorQueJogou === meuNumeroJogador) {
            mostrarFeedback(`⚠️ Seu chute '${letraPalpite}' foi desviado pelo poder Palpite!`, 'orange');
            // Reabilita a tecla, já que o chute não contou para você
            habilitarTeclaVisual(letraPalpite);
        }
    }
    
    // Mostra feedback visual da jogada
    // Apenas mostra feedback de erro se foi o próprio jogador que errou
    if (dados.resultado === 'palpite_acerto' || dados.resultado === 'palpite_desviado') {
        // Já tratamos nas mensagens acima
    } else if (dados.resultado === 'acerto') {
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
            // Reabilita o botão de chute quando o turno volta para o jogador
            chutePalavraDisponivel = true;
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
function iniciarTimer(tempoInicial = null) {
    if (!timerEl) {
        console.error('❌ timerEl não encontrado! Não é possível iniciar o timer.');
        return;
    }
    
    clearInterval(timerInterval);
    
    // Se foi fornecido um tempo inicial, usa ele
    // Se o timer estava pausado, usa o tempo restante salvo
    // Caso contrário, inicia com 15 segundos
    let segundos;
    if (tempoInicial !== null) {
        segundos = tempoInicial;
    } else if (timerRodadaPausado && segundosRestantesRodada > 0) {
        segundos = segundosRestantesRodada;
    } else {
        segundos = 15;
    }
    
    segundosRestantesRodada = segundos;
    timerRodadaPausado = false; // Remove o estado de pausado ao iniciar
    
    timerEl.textContent = `${segundos}s`;
    timerEl.style.color = 'white';
    timerEl.classList.remove('timer-urgente'); // Remove classe urgente ao resetar
    
    log(`⏱️ Timer iniciado: ${segundos}s`);
    
    timerInterval = setInterval(() => {
        // Se o timer está pausado, não decrementa
        if (timerRodadaPausado) {
            return;
        }
        
        segundos--;
        segundosRestantesRodada = segundos;
        
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
            log('⏱️ Tempo esgotado! Passando turno automaticamente...');
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
                    log(`⏱️ Enviando evento de tempo esgotado para passar o turno...`);
                    enviarEvento({
                        tipo: 'tempoEsgotado'
                    });
                }
            }
        }
    }, 1000);
}

function pausarTimerRodada() {
    if (timerInterval && !timerRodadaPausado) {
        timerRodadaPausado = true;
        log(`⏸️ Timer da rodada pausado. Tempo restante: ${segundosRestantesRodada}s`);
    }
}

function retomarTimerRodada() {
    if (timerRodadaPausado && segundosRestantesRodada > 0) {
        timerRodadaPausado = false;
        log(`▶️ Timer da rodada retomado. Tempo restante: ${segundosRestantesRodada}s`);
        // O timer já está rodando, só precisa retomar a contagem
    }
}

// Cache do último turno para evitar atualizações desnecessárias
let ultimoTurnoUI = null;

function atualizarTurnoUI() {
    // Evita atualização se o turno não mudou
    if (ultimoTurnoUI === turnoAtual) {
        return;
    }
    ultimoTurnoUI = turnoAtual;
    
    log(`Atualizando UI do turno: turnoAtual=${turnoAtual}, meuNumeroJogador=${meuNumeroJogador}`);
    
    // Atualiza estado do botão de dica quando o turno muda
    atualizarEstadoBotaoDica();
    
    // Remove a classe de todos primeiro
    if (h2Jogador1) h2Jogador1.classList.remove('active-turn');
    if (h2Jogador2) h2Jogador2.classList.remove('active-turn');
    
    // Adiciona a classe no jogador do turno
    if (turnoAtual === 1 && h2Jogador1) {
        h2Jogador1.classList.add('active-turn');
        log('✓ Jogador 1 está no turno (adicionado active-turn)');
    } else if (turnoAtual === 2 && h2Jogador2) {
        h2Jogador2.classList.add('active-turn');
        log('✓ Jogador 2 está no turno (adicionado active-turn)');
    } else if (turnoAtual !== 1 && turnoAtual !== 2) {
        logWarn('⚠ Turno inválido:', turnoAtual);
    }
    
    // Reabilita poderes quando o turno muda
    reabilitarPoderesNoTurno();
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
    log(`📤 Enviando jogada: ${letra} (turno: ${turnoAtual}, meu número: ${meuNumeroJogador})`);
    
    enviarEvento({
        tipo: 'jogada',
        letra: letra
    });
}

// --- 7. ATUALIZAÇÃO DE UI ---
// Armazena o estado anterior das vidas para detectar mudanças
let vidasAnteriores = [3, 3];

// Versão otimizada com debounce
function atualizarVidasUI(animarVidaExtra = false, jogadorAnimacao = null) {
    log(`💚 Atualizando vidas: J1=${vidas[0]}, J2=${vidas[1]}`);
    
    // Determina o número máximo de vidas para exibir (até 4 para suportar vida extra)
    const maxVidasParaExibir = Math.max(3, vidas[0], vidas[1]);
    
    // Detecta se uma vida foi adicionada (vida extra)
    let vidaAdicionadaJ1 = vidas[0] > vidasAnteriores[0];
    let vidaAdicionadaJ2 = vidas[1] > vidasAnteriores[1];
    
    // Atualiza vidas do jogador 1
    if (vidasP1Container) {
        vidasP1Container.innerHTML = '';
        for (let i = 0; i < maxVidasParaExibir; i++) {
            const vida = document.createElement('span');
            vida.className = 'vida';
            
            // Se esta é a vida recém-adicionada, adiciona classe de animação
            if (vidaAdicionadaJ1 && i === vidas[0] - 1 && (animarVidaExtra || jogadorAnimacao === 1)) {
                vida.classList.add('vida-subindo');
                // Remove a animação após completar
                setTimeout(() => {
                    vida.classList.remove('vida-subindo');
                }, 800);
            }
            
            if (i < vidas[0]) {
                vida.style.backgroundColor = '#00bcd4';
                vida.style.opacity = '1';
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
        for (let i = 0; i < maxVidasParaExibir; i++) {
            const vida = document.createElement('span');
            vida.className = 'vida';
            
            // Se esta é a vida recém-adicionada, adiciona classe de animação
            if (vidaAdicionadaJ2 && i === vidas[1] - 1 && (animarVidaExtra || jogadorAnimacao === 2)) {
                vida.classList.add('vida-subindo');
                // Remove a animação após completar
                setTimeout(() => {
                    vida.classList.remove('vida-subindo');
                }, 800);
            }
            
            if (i < vidas[1]) {
                vida.style.backgroundColor = '#00bcd4';
                vida.style.opacity = '1';
            } else {
                vida.style.backgroundColor = '#555';
                vida.style.opacity = '0.3';
            }
            vidasP2Container.appendChild(vida);
        }
    }
    
    // Atualiza o estado anterior
    vidasAnteriores = [...vidas];
}

// Cache para evitar re-renderizações desnecessárias
let ultimaPalavraExibida = '';
let ultimaPalavraAdversarioExibida = '';

function atualizarPalavraExibida() {
    // Determina qual palavra mostrar para cada jogador
    let minhaPalavra = palavraExibida || gerarPalavraOculta();
    let palavraAdv = palavraAdversarioExibida || '';
    
    log(`📝 Atualizando palavras: Minha="${minhaPalavra}", Adversário="${palavraAdv}"`);
    log(`📝 Elementos encontrados: palavraP1_El=${!!palavraP1_El}, palavraP2_El=${!!palavraP2_El}`);
    
    // Se sou jogador 1, minha palavra vai na primeira posição
    if (meuNumeroJogador === 1) {
        if (palavraP1_El) {
            palavraP1_El.textContent = minhaPalavra;
            log(`✅ Atualizada palavra J1: "${minhaPalavra}"`);
        } else {
            logWarn('⚠️ palavraP1_El não encontrado!');
        }
        if (palavraP2_El) {
            palavraP2_El.textContent = palavraAdv || gerarPalavraOcultaAdversario();
            log(`✅ Atualizada palavra J2: "${palavraAdv || gerarPalavraOcultaAdversario()}"`);
        } else {
            logWarn('⚠️ palavraP2_El não encontrado!');
        }
    } else {
        // Se sou jogador 2, minha palavra vai na segunda posição
        if (palavraP1_El) {
            palavraP1_El.textContent = palavraAdv || gerarPalavraOcultaAdversario();
            log(`✅ Atualizada palavra J1 (adversário): "${palavraAdv || gerarPalavraOcultaAdversario()}"`);
        } else {
            logWarn('⚠️ palavraP1_El não encontrado!');
        }
        if (palavraP2_El) {
            palavraP2_El.textContent = minhaPalavra;
            log(`✅ Atualizada palavra J2: "${minhaPalavra}"`);
        } else {
            logWarn('⚠️ palavraP2_El não encontrado!');
        }
    }
    
    // Atualiza cache após atualizar a UI
    ultimaPalavraExibida = minhaPalavra;
    ultimaPalavraAdversarioExibida = palavraAdv;
}

function gerarPalavraOcultaAdversario() {
    // Gera palavra oculta genérica para o adversário (não sabemos o tamanho)
    return '_ _ _ _ _ _ _';
}

function gerarPalavraOculta() {
    if (!palavraSecreta) return '';
    return palavraSecreta.split('').map(l => l === ' ' ? '  ' : '_ ').join('').trim();
}

// Cache para evitar mudanças desnecessárias de imagem
let ultimosErrosP1 = -1;
let ultimosErrosP2 = -1;

function atualizarBonecosUI() {
    // Cada jogador tem sua própria imagem baseada em seus próprios erros
    const indiceP1 = Math.min(errosJogador1 + 1, 7); // +1 porque as imagens começam em bob1.png
    const indiceP2 = Math.min(errosJogador2 + 1, 7); // +1 porque as imagens começam em patrick1.png
    
    // Só atualiza se os erros mudaram
    if (errosJogador1 !== ultimosErrosP1 && bonecoP1_El) {
        bonecoP1_El.src = `/public/assets/images/bob${indiceP1}.png`;
        ultimosErrosP1 = errosJogador1;
    }
    if (errosJogador2 !== ultimosErrosP2 && bonecoP2_El) {
        bonecoP2_El.src = `/public/assets/images/patrick${indiceP2}.png`;
        ultimosErrosP2 = errosJogador2;
    }
    
    log(`🖼️ Bonecos atualizados: J1 (${errosJogador1} erros) -> bob${indiceP1}.png, J2 (${errosJogador2} erros) -> patrick${indiceP2}.png`);
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

function habilitarTeclaVisual(letra) {
    const btn = [...tecladoContainer.querySelectorAll('.tecla')]
        .find(b => b.textContent === letra);
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
}

// Cache de estado do teclado para evitar atualizações desnecessárias
let ultimoEstadoTeclado = { turno: null, letrasChutadas: null, jogoAtivo: null };
let teclasCache = null;

function atualizarTecladoDesabilitado() {
    // Desabilita todas as letras já chutadas E quando não é o turno do jogador
    if (!tecladoContainer) {
        logWarn('⚠️ tecladoContainer não encontrado!');
        return;
    }
    
    // Garante que os valores são números válidos
    const turnoAtualNum = Number(turnoAtual) || 0;
    const meuNumeroNum = Number(meuNumeroJogador) || 0;
    
    const eMeuTurno = turnoAtualNum === meuNumeroNum && jogoEstaAtivo && meuNumeroNum > 0;
    
    // Cache de letras chutadas como string para comparação rápida
    const letrasChutadasStr = Array.from(letrasChutadas).sort().join(',');
    
    // Evita atualização se o estado não mudou
    if (ultimoEstadoTeclado.turno === eMeuTurno && 
        ultimoEstadoTeclado.letrasChutadas === letrasChutadasStr &&
        ultimoEstadoTeclado.jogoAtivo === jogoEstaAtivo) {
        return;
    }
    
    ultimoEstadoTeclado = { turno: eMeuTurno, letrasChutadas: letrasChutadasStr, jogoAtivo: jogoEstaAtivo };
    
    log(`🔒 Atualizando teclado: eMeuTurno=${eMeuTurno}, turnoAtual=${turnoAtualNum}, meuNumero=${meuNumeroNum}, jogoAtivo=${jogoEstaAtivo}`);
    
    // Cache das teclas para evitar query repetida
    if (!teclasCache) {
        teclasCache = Array.from(tecladoContainer.querySelectorAll('.tecla'));
    }
    
    teclasCache.forEach(btn => {
        const letra = btn.textContent;
        const letraJaChutada = letrasChutadas.has(letra);
        
        // Desabilita se: letra já foi chutada OU não é o turno do jogador
        if (letraJaChutada || !eMeuTurno) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.style.pointerEvents = 'none';
            btn.onclick = null;
        } else {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.style.pointerEvents = 'auto';
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

// Inicia contador visual de reconexão
function iniciarContadorReconexao(segundos) {
    pararContadorReconexao();
    
    let segundosRestantes = segundos;
    
    // Atualiza o timer principal para mostrar o contador de reconexão
    if (timerEl) {
        timerEl.textContent = `${segundosRestantes}s`;
        timerEl.style.color = '#ff9800';
    }
    
    timerReconexao = setInterval(() => {
        segundosRestantes--;
        
        if (timerEl) {
            timerEl.textContent = `${segundosRestantes}s`;
            if (segundosRestantes <= 5) {
                timerEl.style.color = '#ff5555';
            }
        }
        
        if (segundosRestantes <= 0) {
            pararContadorReconexao();
            if (timerEl) {
                timerEl.textContent = 'Aguardando...';
                timerEl.style.color = '#888';
            }
        }
    }, 1000);
}

// Para o contador de reconexão
function pararContadorReconexao() {
    if (timerReconexao) {
        clearInterval(timerReconexao);
        timerReconexao = null;
    }
}

function finalizarJogo(status) {
    jogoEstaAtivo = false;
    clearInterval(timerInterval);
    pararContadorReconexao();
    
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
// Função para desabilitar o botão de chutar
function desabilitarBotaoChutar() {
    const btnChutarPalavra = document.getElementById('btn-chutar-palavra');
    if (btnChutarPalavra) {
        btnChutarPalavra.disabled = true;
        btnChutarPalavra.style.opacity = '0.5';
        btnChutarPalavra.style.cursor = 'not-allowed';
        btnChutarPalavra.title = 'Você já tentou chutar nesta rodada';
    }
}

// Configuração do botão de chutar palavra completa
function configurarChutePalavra() {
    const btnChutarPalavra = document.getElementById('btn-chutar-palavra');
    const modalChutePalavra = document.getElementById('modal-chute-palavra');
    const inputChutePalavra = document.getElementById('input-chute-palavra');
    const btnConfirmarChute = document.getElementById('btn-confirmar-chute');
    const btnCancelarChute = document.getElementById('btn-cancelar-chute');
    
    if (!btnChutarPalavra || !modalChutePalavra || !inputChutePalavra) {
        console.warn('⚠️ Elementos do modal de chute de palavra não encontrados');
        return;
    }
    
    // Abre o modal
    btnChutarPalavra.addEventListener('click', () => {
        if (!jogoEstaAtivo) {
            mostrarFeedback('O jogo não está ativo', 'orange');
            return;
        }
        
        // Verifica se é o turno do jogador
        if (turnoAtual !== meuNumeroJogador) {
            mostrarFeedback('Não é seu turno!', 'orange');
            return;
        }
        
        // Verifica se o chute ainda está disponível nesta rodada
        if (!chutePalavraDisponivel) {
            mostrarFeedback('Você já tentou chutar nesta rodada!', 'orange');
            return;
        }
        
        // Pausa o timer da rodada antes de abrir o modal
        pausarTimerRodada();
        
        modalChutePalavra.classList.add('active');
        inputChutePalavra.value = '';
        inputChutePalavra.focus();
        
        // Inicia timer de 15 segundos para o chute de palavra
        iniciarTimerChutePalavra();
    });
    
    // Fecha o modal ao clicar em cancelar
    if (btnCancelarChute) {
        btnCancelarChute.addEventListener('click', () => {
            pararTimerChutePalavra();
            modalChutePalavra.classList.remove('active');
            inputChutePalavra.value = '';
            
            // Marca o chute como indisponível para esta rodada
            chutePalavraDisponivel = false;
            desabilitarBotaoChutar();
            
            // Retoma o timer da rodada de onde parou
            retomarTimerRodada();
        });
    }
    
    // Fecha o modal ao clicar fora (no backdrop)
    modalChutePalavra.addEventListener('click', (e) => {
        // Verifica se o clique foi no backdrop (fora do conteúdo do modal)
        // O modal-chute-palavra é o backdrop, e modal-chute-palavra-content é o conteúdo
        if (e.target === modalChutePalavra) {
            e.preventDefault();
            e.stopPropagation();
            pararTimerChutePalavra();
            modalChutePalavra.classList.remove('active');
            inputChutePalavra.value = '';
            
            // Marca o chute como indisponível para esta rodada
            chutePalavraDisponivel = false;
            desabilitarBotaoChutar();
            
            // Retoma o timer da rodada de onde parou
            retomarTimerRodada();
        }
    });
    
    // Previne que cliques dentro do conteúdo do modal fechem o modal
    const modalContent = modalChutePalavra.querySelector('.modal-chute-palavra-content');
    if (modalContent) {
        modalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    // Confirma o chute
    if (btnConfirmarChute) {
        btnConfirmarChute.addEventListener('click', () => {
            const palavraChutada = inputChutePalavra.value.trim();
            if (!palavraChutada) {
                mostrarFeedback('Digite uma palavra!', 'orange');
                return;
            }
            
            pararTimerChutePalavra();
            
            // Marca o chute como indisponível para esta rodada (será reabilitado na próxima rodada)
            chutePalavraDisponivel = false;
            desabilitarBotaoChutar();
            
            enviarChutePalavra(palavraChutada);
            modalChutePalavra.classList.remove('active');
            inputChutePalavra.value = '';
        });
    }
    
    // Previne que o input dispare eventos de chute de letra
    inputChutePalavra.addEventListener('keydown', (e) => {
        // Para todas as teclas exceto Enter e Escape, previne propagação
        if (e.key !== 'Enter' && e.key !== 'Escape') {
            e.stopPropagation(); // Impede que o evento chegue ao lidarComChuteDeTecladoFisico
        }
    });
    
    // Confirma com Enter
    inputChutePalavra.addEventListener('keypress', (e) => {
        e.stopPropagation(); // Previne que o Enter dispare outros eventos
        if (e.key === 'Enter') {
            e.preventDefault();
            const palavraChutada = inputChutePalavra.value.trim();
            if (palavraChutada) {
                pararTimerChutePalavra();
                
                // Marca o chute como indisponível para esta rodada (será reabilitado na próxima rodada)
                chutePalavraDisponivel = false;
                desabilitarBotaoChutar();
                
                enviarChutePalavra(palavraChutada);
                modalChutePalavra.classList.remove('active');
                inputChutePalavra.value = '';
            }
        }
    });
    
    // Fecha com Escape
    inputChutePalavra.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            e.preventDefault();
            pararTimerChutePalavra();
            modalChutePalavra.classList.remove('active');
            inputChutePalavra.value = '';
            
            // Marca o chute como indisponível para esta rodada
            chutePalavraDisponivel = false;
            desabilitarBotaoChutar();
            
            // Retoma o timer da rodada de onde parou
            retomarTimerRodada();
        }
    });
    
    // Atualiza o estado do botão baseado no turno e disponibilidade
    function atualizarEstadoBotaoChute() {
        if (btnChutarPalavra) {
            const eMeuTurno = turnoAtual === meuNumeroJogador && jogoEstaAtivo;
            const podeChutar = eMeuTurno && chutePalavraDisponivel;
            
            btnChutarPalavra.disabled = !podeChutar;
            
            if (btnChutarPalavra.disabled) {
                btnChutarPalavra.style.opacity = '0.5';
                btnChutarPalavra.style.cursor = 'not-allowed';
                if (!eMeuTurno) {
                    btnChutarPalavra.title = 'Não é seu turno';
                } else if (!chutePalavraDisponivel) {
                    btnChutarPalavra.title = 'Você já tentou chutar nesta rodada';
                }
            } else {
                btnChutarPalavra.style.opacity = '1';
                btnChutarPalavra.style.cursor = 'pointer';
                btnChutarPalavra.title = 'Chutar palavra completa';
            }
        }
    }
    
    // Atualiza o estado quando o turno muda
    const originalAtualizarTurnoUI = atualizarTurnoUI;
    atualizarTurnoUI = function() {
        originalAtualizarTurnoUI();
        atualizarEstadoBotaoChute();
    };
    
    atualizarEstadoBotaoChute();
}

// Inicia o timer de 15 segundos para o chute de palavra
function iniciarTimerChutePalavra() {
    // Limpa timer anterior se existir
    if (timerChutePalavra) {
        clearInterval(timerChutePalavra);
    }
    
    const timerChuteEl = document.getElementById('timer-chute-palavra');
    if (!timerChuteEl) {
        console.warn('⚠️ Elemento timer-chute-palavra não encontrado');
        return;
    }
    
    let segundos = 15;
    timerChuteEl.textContent = `${segundos}s`;
    timerChuteEl.style.color = 'white';
    timerChuteEl.style.display = 'block';
    
    timerChutePalavra = setInterval(() => {
        segundos--;
        if (timerChuteEl) {
            timerChuteEl.textContent = `${segundos}s`;
        }
        
        if (segundos <= 5 && timerChuteEl) {
            timerChuteEl.style.color = '#ff5555';
        } else if (segundos > 5 && timerChuteEl) {
            timerChuteEl.style.color = 'white';
        }
        
        if (segundos <= 0) {
            clearInterval(timerChutePalavra);
            timerChutePalavra = null;
            if (timerChuteEl) {
                timerChuteEl.style.display = 'none';
            }
            
            // Fecha o modal automaticamente
            const modalChutePalavra = document.getElementById('modal-chute-palavra');
            const inputChutePalavra = document.getElementById('input-chute-palavra');
            if (modalChutePalavra) {
                modalChutePalavra.classList.remove('active');
            }
            if (inputChutePalavra) {
                inputChutePalavra.value = '';
            }
            mostrarFeedback('Tempo esgotado para chutar a palavra!', 'orange');
            
            // Marca o chute como indisponível para esta rodada
            chutePalavraDisponivel = false;
            desabilitarBotaoChutar();
            
            // Retoma o timer da rodada de onde parou
            retomarTimerRodada();
        }
    }, 1000);
}

// Para o timer do chute de palavra
function pararTimerChutePalavra() {
    if (timerChutePalavra) {
        clearInterval(timerChutePalavra);
        timerChutePalavra = null;
    }
    
    const timerChuteEl = document.getElementById('timer-chute-palavra');
    if (timerChuteEl) {
        timerChuteEl.style.display = 'none';
    }
}

// Envia o chute de palavra completa para o servidor
function enviarChutePalavra(palavra) {
    const socket = getSocket();
    if (!socket || !jogoEstaAtivo) {
        mostrarFeedback('Não foi possível enviar o chute', 'red');
        return;
    }
    
    // Para o timer do chute
    pararTimerChutePalavra();
    
    // Não retoma o timer da rodada aqui porque o servidor vai processar o chute
    // e pode mudar o turno ou iniciar nova rodada, então o timer será gerenciado pelo servidor
    
    console.log(`📤 Enviando chute de palavra`);
    
    socket.emit('eventoJogo', {
        tipo: 'chutarPalavra',
        palavra: palavra
    });
}

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
    // Ignora se o input do modal de chute de palavra está focado
    const inputChutePalavra = document.getElementById('input-chute-palavra');
    if (inputChutePalavra && document.activeElement === inputChutePalavra) {
        // Permite digitar normalmente no input, só processa Enter/Escape
        return;
    }
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

// Função para exibir a próxima dica acima da palavra
function exibirProximaDica() {
    // Verifica se há dicas disponíveis
    if (!dicas || dicas.length === 0) {
        mostrarFeedback('Nenhuma dica disponível', 'orange');
        return;
    }
    
    // Incrementa o contador de dicas exibidas (1, 2, 3)
    dicaAtualExibida++;
    
    // Verifica se há uma dica para exibir (máximo 3)
    if (dicaAtualExibida > 3 || dicaAtualExibida > dicas.length) {
        mostrarFeedback('Todas as dicas já foram exibidas', 'orange');
        return;
    }
    
    // Encontra a dica com a ordem correspondente
    const dica = dicas.find(d => d.ordem === dicaAtualExibida);
    if (!dica || !dica.texto) {
        mostrarFeedback('Dica não encontrada', 'orange');
        return;
    }
    
    // Exibe a dica acima da palavra do jogador
    const dicaPalavraEl = meuNumeroJogador === 1 
        ? document.getElementById('dica-palavra-jogador1')
        : document.getElementById('dica-palavra-jogador2');
    
    if (dicaPalavraEl) {
        dicaPalavraEl.textContent = dica.texto;
        dicaPalavraEl.classList.add('mostrar');
        log(`💡 Dica ${dicaAtualExibida} exibida: ${dica.texto}`);
    }
    
    // Atualiza estado do botão de dica
    atualizarEstadoBotaoDica();
    
    // Passa o turno automaticamente
    enviarEvento({
        tipo: 'pedirDica'
    });
}

// Função para ocultar dicas acima das palavras
function ocultarDica() {
    const dicaPalavraJ1 = document.getElementById('dica-palavra-jogador1');
    const dicaPalavraJ2 = document.getElementById('dica-palavra-jogador2');
    
    if (dicaPalavraJ1) {
        dicaPalavraJ1.textContent = '';
        dicaPalavraJ1.classList.remove('mostrar');
    }
    if (dicaPalavraJ2) {
        dicaPalavraJ2.textContent = '';
        dicaPalavraJ2.classList.remove('mostrar');
    }
}

// Configura o botão de dica
function configurarBotaoDica() {
    const btnDica = document.getElementById('btn-dica');
    if (!btnDica) {
        logWarn('⚠️ Botão de dica não encontrado!');
        return;
    }
    
    btnDica.addEventListener('click', () => {
        // Verifica se o jogo está ativo
        if (!jogoEstaAtivo) {
            mostrarFeedback('O jogo não está ativo!', 'orange');
            return;
        }
        
        // Verifica se é o turno do jogador
        if (turnoAtual !== meuNumeroJogador) {
            mostrarFeedback('Você só pode pedir dica no seu turno!', 'orange');
            return;
        }
        
        // Verifica se já exibiu todas as dicas
        if (dicaAtualExibida >= 3) {
            mostrarFeedback('Todas as dicas já foram exibidas!', 'orange');
            return;
        }
        
        // Envia evento para pedir dica (o backend vai passar o turno)
        enviarEvento({
            tipo: 'pedirDica'
        });
    });
    
    // Atualiza disponibilidade do botão
    atualizarEstadoBotaoDica();
}

// Atualiza o estado do botão de dica
function atualizarEstadoBotaoDica() {
    const btnDica = document.getElementById('btn-dica');
    if (!btnDica) return;
    
    // Botão só está disponível se:
    // 1. O jogo está ativo
    // 2. É o turno do jogador
    // 3. Ainda há dicas disponíveis
    const eMeuTurno = turnoAtual === meuNumeroJogador && jogoEstaAtivo;
    const todasDicasExibidas = dicaAtualExibida >= 3;
    
    if (eMeuTurno && !todasDicasExibidas) {
        btnDica.disabled = false;
        btnDica.style.opacity = '1';
        btnDica.style.cursor = 'pointer';
    } else {
        btnDica.disabled = true;
        btnDica.style.opacity = '0.5';
        btnDica.style.cursor = 'not-allowed';
    }
}
