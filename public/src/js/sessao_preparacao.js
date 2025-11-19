import { conectarSocket, aoReceberEvento, enviarEvento } from './socket.js';

const urlParams = new URLSearchParams(window.location.search);
const sala = urlParams.get('sala');
const categoria = urlParams.get('categoria') || 'Geral';
const token = localStorage.getItem('token');
const nome = JSON.parse(atob(token.split('.')[1])).nome;

document.querySelector('.codigo-container span').textContent = sala;

let jogadoresProntos = new Set();
let usuarioPronto = false;
const botaoPronto = document.querySelector('.botao-pronto');

// Inicializa contador em 0/2
document.querySelector('.contador').textContent = '( 0 / 2 )';

// Conecta ao socket e entra na sala
conectarSocket(sala, nome, categoria);

// Atualiza contador de jogadores prontos
aoReceberEvento((evento) => {
  if (evento.tipo === 'pronto') {
    jogadoresProntos.add(evento.nome);
    // Atualiza contador com o total de prontos recebido do servidor (mais confiável)
    const totalProntos = evento.total || jogadoresProntos.size;
    document.querySelector('.contador').textContent = `( ${totalProntos} / 2 )`;
    
    // Se o evento é do próprio usuário, desabilita o botão
    if (evento.nome === nome) {
      usuarioPronto = true;
      botaoPronto.disabled = true;
      botaoPronto.textContent = 'Pronto!';
      botaoPronto.style.opacity = '0.6';
      botaoPronto.style.cursor = 'not-allowed';
    }
    
    // Quando ambos estiverem prontos (usando o total do servidor), redireciona
    if (totalProntos === 2) {
      window.location.href = `game.html?sala=${sala}&categoria=${categoria}`;
    }
  }
  
  // Também escuta o evento 'inicio' do servidor como fallback
  if (evento.tipo === 'inicio') {
    window.location.href = `game.html?sala=${sala}&categoria=${categoria}`;
  }
});

// Envia evento de "pronto" ao clicar no botão
botaoPronto.addEventListener('click', () => {
  if (usuarioPronto) return; // Evita múltiplos cliques
  
  usuarioPronto = true;
  botaoPronto.disabled = true;
  botaoPronto.textContent = 'Pronto!';
  botaoPronto.style.opacity = '0.6';
  botaoPronto.style.cursor = 'not-allowed';
  
  enviarEvento({
    tipo: 'pronto',
    nome
  });
});
