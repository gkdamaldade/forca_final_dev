import { conectarSocket, aoReceberEvento, enviarEvento } from './socket.js';

const urlParams = new URLSearchParams(window.location.search);
const sala = urlParams.get('sala');
const categoria = urlParams.get('categoria') || 'Geral';
const token = localStorage.getItem('token');
const nome = JSON.parse(atob(token.split('.')[1])).nome;

document.querySelector('.codigo-container span').textContent = sala;

let jogadoresProntos = new Set();

// Conecta ao socket e entra na sala
conectarSocket(sala, nome, categoria);

// Atualiza contador de jogadores conectados
aoReceberEvento((evento) => {
  if (evento.tipo === 'conectado') {
    document.querySelector('.contador').textContent = `( ${evento.total} / 2 )`;
  }

  if (evento.tipo === 'pronto') {
    jogadoresProntos.add(evento.nome);
    if (jogadoresProntos.size === 2) {
      window.location.href = `game.html?sala=${sala}&categoria=${categoria}`;
    }
  }
});

// Envia evento de “pronto” ao clicar no botão
document.querySelector('.botao-pronto').addEventListener('click', () => {
  enviarEvento({
    tipo: 'pronto',
    nome
  });
});
