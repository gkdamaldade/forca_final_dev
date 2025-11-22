import { conectarSocket, aoReceberEvento, enviarEvento, getMeuSocketId } from './socket.js';

const urlParams = new URLSearchParams(window.location.search);
const sala = urlParams.get('sala');
const categoria = urlParams.get('categoria') || 'Geral';
const token = localStorage.getItem('token');
const payload = JSON.parse(atob(token.split('.')[1]));
const nome = payload.nome || payload.name;
const playerId = payload.id || null;

// Identificador único para esta instância da página (útil para debug e garantir unicidade)
const instanceId = `${nome}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

document.querySelector('.codigo-container span').textContent = sala;

let jogadoresProntos = new Set();
let usuarioPronto = false;
const botaoPronto = document.querySelector('.botao-pronto');

// Variáveis de aposta
let saldoMoedas = 0;
let minhaAposta = 0;
let apostaAdversario = null;

// Inicializa contador em 0/2
document.querySelector('.contador').textContent = '( 0 / 2 )';

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
      document.getElementById('saldo-moedas').textContent = saldoMoedas;
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
  const inputAposta = document.getElementById('input-aposta');
  const mensagemAposta = document.getElementById('aposta-mensagem');
  const apostaAdversarioEl = document.getElementById('aposta-adversario');
  const botoesRapidos = document.querySelectorAll('.btn-aposta-quick');
  
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
  
  // Inicializa mensagem
  atualizarMensagemAposta();
}

// Carrega saldo e configura apostas ao iniciar
carregarSaldoMoedas().then(() => {
  configurarApostas();
});

// Conecta ao socket e entra na sala
conectarSocket(sala, nome, playerId, categoria);

// Atualiza contador de jogadores prontos
aoReceberEvento((evento) => {
  console.log(`[${instanceId}] 📨 Evento recebido:`, evento);
  
  if (evento.tipo === 'pronto') {
    console.log(`[${instanceId}] ✅ Evento 'pronto' recebido:`, evento);
    jogadoresProntos.add(evento.nome);
    // Atualiza contador com o total de prontos recebido do servidor (mais confiável)
    const totalProntos = evento.total || jogadoresProntos.size;
    document.querySelector('.contador').textContent = `( ${totalProntos} / 2 )`;
    console.log(`[${instanceId}] 📊 Total de prontos: ${totalProntos}/2`);
    
    // Verifica se o evento é do próprio usuário usando socket.id (mais confiável que nome)
    // Isso evita problemas quando dois usuários têm o mesmo nome
    const meuSocketId = getMeuSocketId();
    const eventoEDoMeuSocket = evento.socketId && evento.socketId === meuSocketId;
    const eventoEDoMeuNome = evento.nome === nome;
    
    console.log(`[${instanceId}] 🔍 Verificação: meuSocketId=${meuSocketId}, eventoSocketId=${evento.socketId}, eventoEDoMeuSocket=${eventoEDoMeuSocket}, eventoEDoMeuNome=${eventoEDoMeuNome}, usuarioPronto=${usuarioPronto}`);
    
    // Se o evento é do próprio socket OU (do próprio nome E ainda não está pronto)
    // Usa socket.id como prioridade, mas fallback para nome se socket.id não estiver disponível
    if ((eventoEDoMeuSocket || (eventoEDoMeuNome && !evento.socketId)) && !usuarioPronto) {
      console.log(`[${instanceId}] ✅ Usuário ${nome} (socket: ${meuSocketId}) marcado como pronto via evento do servidor`);
      usuarioPronto = true;
      botaoPronto.disabled = true;
      botaoPronto.textContent = 'Pronto!';
      botaoPronto.style.opacity = '0.6';
      botaoPronto.style.cursor = 'not-allowed';
    }
    
    // Quando ambos estiverem prontos (usando o total do servidor), redireciona
    if (totalProntos === 2) {
      console.log(`[${instanceId}] 🎮 Ambos os jogadores estão prontos! Redirecionando para o jogo...`);
      setTimeout(() => {
        window.location.href = `game.html?sala=${sala}&categoria=${categoria}`;
      }, 500);
    }
  }
  
  // Também escuta o evento 'inicio' do servidor como fallback
  if (evento.tipo === 'inicio') {
    console.log(`[${instanceId}] 🎮 Evento 'inicio' recebido! Redirecionando para o jogo...`);
    window.location.href = `game.html?sala=${sala}&categoria=${categoria}`;
  }
  
  if (evento.tipo === 'preparacao') {
    console.log(`[${instanceId}] ⏳ Modo preparação ativado`);
  }
  
  if (evento.tipo === 'erro') {
    console.error(`[${instanceId}] ❌ Erro do servidor:`, evento.mensagem);
    alert(`Erro: ${evento.mensagem}`);
  }
  
  // Evento de aposta do adversário
  if (evento.tipo === 'apostaAtualizada') {
    console.log(`[${instanceId}] 💰 Aposta atualizada:`, evento);
    if (evento.jogador !== nome) {
      apostaAdversario = evento.valor;
      const apostaAdversarioEl = document.getElementById('aposta-adversario');
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
  }
});

// Envia evento de "pronto" ao clicar no botão
botaoPronto.addEventListener('click', () => {
  if (usuarioPronto) {
    console.log(`[${instanceId}] ⚠️ Tentativa de clicar novamente no botão pronto - ignorado`);
    return; // Evita múltiplos cliques
  }
  
  console.log(`[${instanceId}] 🖱️ Usuário ${nome} clicou em pronto`);
  usuarioPronto = true;
  botaoPronto.disabled = true;
  botaoPronto.textContent = 'Pronto!';
  botaoPronto.style.opacity = '0.6';
  botaoPronto.style.cursor = 'not-allowed';
  
  console.log(`[${instanceId}] 📤 Enviando evento 'pronto' para o servidor...`);
  enviarEvento({
    tipo: 'pronto',
    nome,
    aposta: minhaAposta // Inclui a aposta ao enviar "pronto"
  });
});
