let socket;
let meuSocketId = null; // Armazena o ID do socket desta instância

/**
 * Conecta ao servidor WebSocket e entra na sala informada.
 * @param {string} sala - ID da sala
 * @param {string} nome - Nome do jogador
 * @param {number} playerId - ID do jogador no banco de dados
 * @param {string} categoria - Categoria da palavra (opcional)
 */
// Variáveis para armazenar dados de conexão (para reconexão automática)
let dadosConexao = null;

export function conectarSocket(sala, nome, playerId, categoria) {
  console.log(`🔌 conectarSocket chamado: sala=${sala}, nome=${nome}, playerId=${playerId}, categoria=${categoria}`);
  
  const categoriaSlug = (categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
  
  // Armazena dados de conexão para reconexão automática
  dadosConexao = {
    sala,
    nome,
    playerId,
    categoriaSlug: categoriaSlug || null
  };
  
  // Sempre cria uma nova conexão para garantir isolamento entre abas/instâncias
  // Isso é importante quando testando na mesma máquina
  if (socket && socket.connected) {
    console.log(`🔌 Desconectando socket anterior: ${socket.id}`);
    // Se já existe uma conexão ativa, desconecta antes de criar nova
    socket.disconnect();
  }
  socket = io({
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    transports: ['websocket', 'polling']
  });
  
  // Armazena o socket.id e entra na sala quando a conexão for estabelecida
  socket.on('connect', () => {
    meuSocketId = socket.id;
    console.log(`✅ Socket conectado com ID: ${meuSocketId}`);
    if (dadosConexao) {
      console.log(`📤 Enviando joinRoom: roomId=${dadosConexao.sala}, playerName=${dadosConexao.nome}, playerId=${dadosConexao.playerId}, categoria=${dadosConexao.categoriaSlug}`);
      socket.emit('joinRoom', { 
        roomId: dadosConexao.sala, 
        playerName: dadosConexao.nome, 
        playerId: dadosConexao.playerId, 
        categoria: dadosConexao.categoriaSlug 
      });
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`❌ Socket desconectado: ${socket.id}, motivo: ${reason}`);
    meuSocketId = null;
  });
  
  socket.on('reconnect', (attemptNumber) => {
    console.log(`🔄 Socket reconectado após ${attemptNumber} tentativa(s)`);
    meuSocketId = socket.id;
    // Reenvia joinRoom automaticamente na reconexão
    if (dadosConexao) {
      console.log(`📤 Reenviando joinRoom após reconexão: roomId=${dadosConexao.sala}, playerName=${dadosConexao.nome}, playerId=${dadosConexao.playerId}, categoria=${dadosConexao.categoriaSlug}`);
      socket.emit('joinRoom', { 
        roomId: dadosConexao.sala, 
        playerName: dadosConexao.nome, 
        playerId: dadosConexao.playerId, 
        categoria: dadosConexao.categoriaSlug 
      });
    }
  });
  
  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`🔄 Tentativa de reconexão ${attemptNumber}...`);
  });
  
  socket.on('reconnect_error', (error) => {
    console.error(`❌ Erro ao tentar reconectar:`, error);
  });
  
  socket.on('reconnect_failed', () => {
    console.error(`❌ Falha ao reconectar após todas as tentativas`);
  });
  
  socket.on('connect_error', (error) => {
    console.error(`❌ Erro ao conectar socket:`, error);
  });
  
  // Se já estiver conectado, envia imediatamente
  if (socket.connected && dadosConexao) {
    meuSocketId = socket.id;
    console.log(`📤 Socket já conectado, enviando joinRoom imediatamente`);
    socket.emit('joinRoom', { 
      roomId: dadosConexao.sala, 
      playerName: dadosConexao.nome, 
      playerId: dadosConexao.playerId, 
      categoria: dadosConexao.categoriaSlug 
    });
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
