// game.js - Versão Final HTTP (Turnos, Poderes e Melhor de 3)

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
// Seletores dos botões de poder
const poderesP1Container = document.querySelector('.area-inferior .poderes-jogador:nth-child(1)');
const poderesP2Container = document.querySelector('.area-inferior .poderes-jogador:nth-child(3)');



// Simulação de Poderes Equipados (Isso viria do banco futuramente)
const poderP1 = 'orochimaru'; // P1: Vida Extra
const poderP2 = 'etanol';     // P2: Ataque de Vida

// --- 3. ESTADO DO JOGO ---
let vidasP1 = 2;      // Vidas da Partida (Melhor de 3)
let vidasP2 = 2;
let maxErrosP1 = 6;   // Saúde do Personagem (padrão)
let maxErrosP2 = 6;
let errosP1 = 0;
let errosP2 = 0;
let errosBackend = 0; // Para sincronia

let jogadorDaVez = 1; 
let jogoEstaAtivo = true; 
let timerInterval = null;
let letrasChutadas = new Set(); 

// --- 4. INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    iniciarNovaRodada();
    document.addEventListener('keydown', lidarComChuteDeTecladoFisico);
    configurarTecladoVirtual();
    configurarBotoesDePoder(); 
});

// --- 5. LÓGICA DE TEMPO E TURNO ---

function iniciarTimer() {
    clearInterval(timerInterval);
    let segundos = 15;
    timerEl.textContent = `${segundos}s`;
    
    // Visual: Muda cor se estiver acabando
    timerEl.style.color = 'white';

    timerInterval = setInterval(() => {
        segundos--;
        timerEl.textContent = `${segundos}s`;
        
        if (segundos <= 5) timerEl.style.color = '#ff5555';

        if (segundos <= 0) {
            clearInterval(timerInterval);
            console.log(`Tempo esgotado para Jogador ${jogadorDaVez}!`);
            trocarTurno();
        }
    }, 1000);
}

function trocarTurno() {
    if (!jogoEstaAtivo) return;
    
    // Troca de 1 para 2, ou de 2 para 1
    jogadorDaVez = (jogadorDaVez === 1) ? 2 : 1;
    
    atualizarTurnoUI();
    iniciarTimer(); // Reinicia o tempo para o próximo
}

function atualizarTurnoUI() {
    // Destaca o nome do jogador da vez
    if (jogadorDaVez === 1) {
        h2Jogador1.classList.add('active-turn');
        h2Jogador2.classList.remove('active-turn');
    } else {
        h2Jogador1.classList.remove('active-turn');
        h2Jogador2.classList.add('active-turn');
    }
}

// --- 6. LÓGICA DO JOGO (API) ---

async function iniciarNovaRodada() {
    console.log("--- Iniciando novo round ---");
    jogoEstaAtivo = true;
    letrasChutadas.clear();
    resetarUI(); 
    
    // Reset dos contadores do round
    errosP1 = 0;
    errosP2 = 0;
    errosBackend = 0;
    
    // Lógica do Poder Passivo (Orochimaru) - Só no início da partida
    if (vidasP1 === 2 && vidasP2 === 2) {
        if (poderP1 === 'orochimaru') maxErrosP1 = 8;
        if (poderP2 === 'orochimaru') maxErrosP2 = 8;
    }
    
    atualizarBonecosUI();
    atualizarPlacarDeVidas();

    // P1 sempre começa o round
    jogadorDaVez = 1;
    atualizarTurnoUI();
    iniciarTimer();
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/novo-jogo`);
        if (!response.ok) throw new Error('Erro na API');
        const dados = await response.json();
        atualizarTela(dados);
    } catch (error) {
        console.error(error);
        categoriaEl.textContent = "Erro de Conexão"; 
    }
}

async function processarChute(letra) {
    if (!jogoEstaAtivo || letrasChutadas.has(letra)) return; 

    console.log(`Jogador ${jogadorDaVez} chutou: ${letra}`);
    letrasChutadas.add(letra);
    desabilitarTeclaVisual(letra);
    clearInterval(timerInterval); // Pausa o tempo enquanto processa

    try {
        const response = await fetch(`${BACKEND_URL}/api/chutar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ letra: letra })
        });
        
        const dados = await response.json();

        // Verifica se houve erro (dano)
        if (dados.erros > errosBackend) {
            // Aplica o dano ao jogador da vez
            (jogadorDaVez === 1) ? errosP1++ : errosP2++;
            // Som de erro poderia ir aqui
        }
        errosBackend = dados.erros;
        
        atualizarTela(dados);
        
        // --- NOVA LÓGICA DE TURNO ---
        // Se o jogo continua, SEMPRE troca o turno (independente de acerto/erro)
        if (jogoEstaAtivo) {
            // Lógica de morte por dano excessivo (mantida)
            if (jogadorDaVez === 1 && errosP1 >= maxErrosP1) {
                finalizarRound('derrota'); 
            } else if (jogadorDaVez === 2 && errosP2 >= maxErrosP2) {
                finalizarRound('derrota'); 
            } else {
                 // AQUI ESTÁ A MUDANÇA:
                 // Não importa se acertou ou errou, passa a vez.
                 trocarTurno();
            }
        }

    } catch (error) {
        console.error(error);
        // Se der erro na rede, tenta recuperar
        iniciarTimer(); 
    }
}
async function processarPoder(poderId, jogador) {
    if (!jogoEstaAtivo) return;
    console.log(`Jogador ${jogador} usou poder: ${poderId}`);
    clearInterval(timerInterval);

    try {
        const response = await fetch(`${BACKEND_URL}/api/usar-poder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ poderId, jogador })
        });
        const resultado = await response.json();

        if (resultado.tipo === 'gameState') {
            atualizarTela(resultado.estado); // Mago Negro
        } else if (resultado.tipo === 'ataqueVida' && resultado.sucesso) {
            // Etanol (Tirar Vida)
            (resultado.alvo === 1) ? vidasP1-- : vidasP2--;
            atualizarPlacarDeVidas();
        }

        // Usar poder gasta o turno? Geralmente sim.
        if (jogoEstaAtivo) {
            checarFimDePartida();
            trocarTurno();
        }

    } catch (error) {
        console.error(error);
        iniciarTimer();
    }
}

// --- 7. ATUALIZAÇÃO DE TELA ---

function atualizarTela(dados) {
    palavraP1_El.textContent = dados.palavra;
    palavraP2_El.textContent = dados.palavra;
    categoriaEl.textContent = dados.categoria;
    
    letrasChutadas = new Set(dados.letrasChutadas);
    atualizarBonecosUI();

    if (dados.status === 'vitoria') finalizarRound('vitoria');
    // Nota: A derrota pelo backend (6 erros totais) é ignorada 
    // em favor da nossa lógica de vida individual (maxErrosP1/P2).
}

function finalizarRound(resultado) {
    jogoEstaAtivo = false;
    clearInterval(timerInterval);

    if (resultado === 'vitoria') {
        // Quem jogou por último (e acertou) venceu
        console.log(`Vitoria do Jogador ${jogadorDaVez}`);
        (jogadorDaVez === 1) ? vidasP2-- : vidasP1--;
    } else {
        // Derrota (por dano): Quem jogou por último perdeu
        console.log(`Derrota do Jogador ${jogadorDaVez}`);
        (jogadorDaVez === 1) ? vidasP1-- : vidasP2--;
    }

    atualizarPlacarDeVidas();
    
    // Verifica se acabou a partida inteira
    if (!checarFimDePartida()) {
        // Se não acabou, prepara o próximo round
        setTimeout(iniciarNovaRodada, 2000);
    }
}

function checarFimDePartida() {
    if (vidasP1 <= 0) {
        redirecionarFim('lost'); // P1 perdeu
        return true;
    } else if (vidasP2 <= 0) {
        redirecionarFim('win'); // P1 ganhou (P2 perdeu)
        return true;
    }
    return false;
}

async function redirecionarFim(tipo) {
    // Salvar vitória se for o caso (opcional)
    // if (tipo === 'win') await salvarVitoria(); 
    setTimeout(() => window.location.href = `${tipo}.html`, 2000);
}

// --- 8. HELPERS VISUAIS ---

function atualizarBonecosUI() {
    // Garante que o índice da imagem não passe do limite (ex: bob6.png)
    // Usa min() para travar na imagem de "morto"
    if(bonecoP1_El) bonecoP1_El.src = `public/assets/images/bob${Math.min(errosP1 + 1, 7)}.png`;
    if(bonecoP2_El) bonecoP2_El.src = `public/assets/images/patrick${Math.min(errosP2 + 1, 7)}.png`;
}

function atualizarPlacarDeVidas() {
    const desenharVidas = (container, qtd) => {
        container.innerHTML = '';
        for(let i=0; i<qtd; i++) container.innerHTML += '<span class="vida"></span>';
    };
    desenharVidas(vidasP1Container, vidasP1);
    desenharVidas(vidasP2Container, vidasP2);
}

function resetarUI() {
    if (tecladoContainer) {
        tecladoContainer.querySelectorAll('.tecla').forEach(b => b.disabled = false);
    }
    if (poderesP1Container) {
        poderesP1Container.querySelectorAll('.poder').forEach(b => b.disabled = false);
    }
    if (poderesP2Container) {
        poderesP2Container.querySelectorAll('.poder').forEach(b => b.disabled = false);
    }
}

function desabilitarTeclaVisual(letra) {
    const btn = [...tecladoContainer.querySelectorAll('.tecla')]
        .find(b => b.textContent === letra);
    if (btn) btn.disabled = true;
}

// --- 9. EVENT LISTENERS ---

function configurarTecladoVirtual() {
    if (!tecladoContainer) return;
    tecladoContainer.addEventListener('click', e => {
        if (e.target.classList.contains('tecla') && !e.target.disabled) {
            processarChute(e.target.textContent);
        }
    });
}

function configurarBotoesDePoder() {
    // Lógica simplificada: P1 usa container 1, P2 usa container 2
    const bindPoder = (container, jogador) => {
        if (!container) return;
        container.addEventListener('click', e => {
            const btn = e.target.closest('.poder');
            // Só deixa clicar se for a vez do jogador E se o botão estiver ativo
            if (btn && !btn.disabled && jogador === jogadorDaVez) {
                const poderId = (jogador === 1) 
                    ? (poderP1 === 'orochimaru' ? 'mago-negro' : poderP1) 
                    : poderP2;
                
                btn.disabled = true;
                processarPoder(poderId, jogador);
            }
        });
    };

    bindPoder(poderesP1Container, 1);
    bindPoder(poderesP2Container, 2);
}

function lidarComChuteDeTecladoFisico(e) {
    const letra = e.key.toUpperCase();
    if (letra.length === 1 && letra >= 'A' && letra <= 'Z') {
        // Verifica se o botão visual já não está desabilitado
        const btn = [...tecladoContainer.querySelectorAll('.tecla')]
            .find(b => b.textContent === letra);
        
        if (btn && !btn.disabled) processarChute(letra);
    }
}
