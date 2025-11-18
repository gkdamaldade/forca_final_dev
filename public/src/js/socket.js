let socket;

/**
 * Conecta ao servidor WebSocket e entra na sala informada.
 * @param {string} sala - ID da sala
 * @param {string} nome - Nome do jogador
 * @param {string} categoria - Categoria da palavra (opcional)
 */
export function conectarSocket(sala, nome, categoria) {
  if (!socket) {
    socket = io();
  }
  const categoriaSlug = (categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
  socket.emit('joinRoom', { roomId: sala, playerName: nome, categoria: categoriaSlug || null });
}

/**
 * Envia um evento do jogo para o servidor.
 * @param {object} dados - Objeto com tipo e conteúdo do evento
 */
export function enviarEvento(dados) {
  if (socket) {
    socket.emit('eventoJogo', dados);
  }
}

/**
 * Escuta eventos do servidor e executa um callback.
 * @param {function} callback - Função que recebe o evento
 */
export function aoReceberEvento(callback) {
  if (socket) {
    socket.on('eventoJogo', callback);
  }
}

/**
 * (Opcional) Retorna a instância do socket para uso direto.
 */
export function getSocket() {
  return socket;
}
