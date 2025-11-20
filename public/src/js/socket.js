let socket;
let meuSocketId = null; // Armazena o ID do socket desta instância

/**
 * Conecta ao servidor WebSocket e entra na sala informada.
 * @param {string} sala - ID da sala
 * @param {string} nome - Nome do jogador
 * @param {string} categoria - Categoria da palavra (opcional)
 */
export function conectarSocket(sala, nome, categoria) {
  console.log(`🔌 conectarSocket chamado: sala=${sala}, nome=${nome}, categoria=${categoria}`);
  
  // Sempre cria uma nova conexão para garantir isolamento entre abas/instâncias
  // Isso é importante quando testando na mesma máquina
  if (socket && socket.connected) {
    console.log(`🔌 Desconectando socket anterior: ${socket.id}`);
    // Se já existe uma conexão ativa, desconecta antes de criar nova
    socket.disconnect();
  }
  socket = io();
  
  const categoriaSlug = (categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
  
  // Armazena o socket.id e entra na sala quando a conexão for estabelecida
  socket.on('connect', () => {
    meuSocketId = socket.id;
    console.log(`✅ Socket conectado com ID: ${meuSocketId}`);
    console.log(`📤 Enviando joinRoom: roomId=${sala}, playerName=${nome}, categoria=${categoriaSlug || null}`);
    socket.emit('joinRoom', { roomId: sala, playerName: nome, categoria: categoriaSlug || null });
  });
  
  socket.on('disconnect', () => {
    console.log(`❌ Socket desconectado: ${socket.id}`);
    meuSocketId = null;
  });
  
  socket.on('connect_error', (error) => {
    console.error(`❌ Erro ao conectar socket:`, error);
  });
  
  // Se já estiver conectado, envia imediatamente
  if (socket.connected) {
    meuSocketId = socket.id;
    console.log(`📤 Socket já conectado, enviando joinRoom imediatamente`);
    socket.emit('joinRoom', { roomId: sala, playerName: nome, categoria: categoriaSlug || null });
  }
}

/**
 * Retorna o ID do socket desta instância
 */
export function getMeuSocketId() {
  return meuSocketId;
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
    // Remove listeners anteriores para evitar duplicação
    socket.off('eventoJogo');
    socket.on('eventoJogo', (evento) => {
      console.log('🔔 Socket recebeu evento via aoReceberEvento:', evento);
      callback(evento);
    });
    console.log('✅ Listener de eventoJogo configurado no socket');
  } else {
    console.warn('⚠️ Socket não existe ainda ao tentar configurar listener. Tentando novamente em 100ms...');
    setTimeout(() => {
      if (socket) {
        socket.off('eventoJogo');
        socket.on('eventoJogo', (evento) => {
          console.log('🔔 Socket recebeu evento via aoReceberEvento (retry):', evento);
          callback(evento);
        });
        console.log('✅ Listener de eventoJogo configurado no socket (retry)');
      } else {
        console.error('❌ Socket ainda não existe após retry!');
      }
    }, 100);
  }
}

/**
 * (Opcional) Retorna a instância do socket para uso direto.
 */
export function getSocket() {
  return socket;
}
