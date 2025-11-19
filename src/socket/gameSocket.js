const { getRandomWord } = require('../services/wordService');

const activeGames = new Map();

module.exports = function(io) {
  io.on('connection', socket => {
    console.log('🎮 Conectado:', socket.id);

    socket.on('joinRoom', async ({ roomId, playerName, categoria }) => {
      socket.join(roomId);
      socket.data = { nome: playerName, sala: roomId };
      
      if (!activeGames.has(roomId)) {
        try {
          // Busca palavra aleatória do banco filtrando por categoria
          const wordObj = await getRandomWord({ categoria: categoria });
          const palavra = (wordObj?.palavra || 'FORCA').toUpperCase();
          const categoriaUsada = wordObj?.categoria || categoria;
          
          activeGames.set(roomId, {
            players: [],
            word: palavra,
            turno: 1,
            categoria: categoriaUsada,
            prontos: new Set() // Armazena socket.id dos jogadores prontos
          });
        } catch (error) {
          console.error('Erro ao buscar palavra:', error);
          // Fallback caso não encontre palavra
          activeGames.set(roomId, {
            players: [],
            word: 'FORCA',
            turno: 1,
            categoria: categoria || 'Geral',
            prontos: new Set() // Armazena socket.id dos jogadores prontos
          });
        }
      }

      const game = activeGames.get(roomId);
      game.players.push({ id: socket.id, name: playerName });

      const total = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      io.to(roomId).emit('eventoJogo', { tipo: 'conectado', total });

      if (game.players.length === 2) {
        const [j1, j2] = game.players;
        if (game.prontos.size === 2) {
          io.to(j1.id).emit('eventoJogo', { tipo: 'inicio', jogador: 1, adversario: j2.name, palavra: game.word, turno: game.turno, categoria: game.categoria });
          io.to(j2.id).emit('eventoJogo', { tipo: 'inicio', jogador: 2, adversario: j1.name, palavra: game.word, turno: game.turno, categoria: game.categoria });
        } else {
          io.to(j1.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
          io.to(j2.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
        }
      }
    });

    socket.on('eventoJogo', msg => {
      const roomId = [...socket.rooms].find(r => r !== socket.id);
      const game = activeGames.get(roomId);
      if (!game) return;

      if (msg.tipo === 'pronto') {
        // Usa o nome do socket.data (mais confiável que msg.nome do cliente)
        const nomeJogador = socket.data?.nome || msg.nome;
        
        // Adiciona o socket.id ao set de prontos (identificador único)
        // Isso evita problemas se dois jogadores tiverem o mesmo nome
        const jogadorAtual = game.players.find(p => p.id === socket.id);
        if (jogadorAtual && !game.prontos.has(socket.id)) {
          game.prontos.add(socket.id);
        }

        // Envia evento para TODOS na sala informando quem está pronto
        io.to(roomId).emit('eventoJogo', {
          tipo: 'pronto',
          nome: nomeJogador,
          socketId: socket.id, // Inclui o socket.id para identificação única
          total: game.prontos.size
        });

        // Quando ambos estiverem prontos, iniciar o jogo
        if (game.prontos.size === 2) {
          const [j1, j2] = game.players;

          io.to(j1.id).emit('eventoJogo', {
            tipo: 'inicio',
            jogador: 1,
            adversario: j2.name,
            palavra: game.word,
            turno: game.turno,
            categoria: game.categoria
          });

          io.to(j2.id).emit('eventoJogo', {
            tipo: 'inicio',
            jogador: 2,
            adversario: j1.name,
            palavra: game.word,
            turno: game.turno,
            categoria: game.categoria
          });
        }
      }

      if (msg.tipo === 'jogada') {
        game.turno = game.turno === 1 ? 2 : 1;

        io.to(roomId).emit('eventoJogo', {
          tipo: 'jogada',
          letra: msg.letra,
          turno: game.turno
        });
      }

      if (msg.tipo === 'poder') {
        io.to(roomId).emit('eventoJogo', {
          tipo: 'poder',
          poder: msg.poder,
          jogador: msg.jogador
        });
      }

      if (msg.tipo === 'fim') {
        io.to(roomId).emit('eventoJogo', {
          tipo: 'fim',
          vencedor: msg.vencedor
        });
        activeGames.delete(roomId);
      }
    });

    socket.on('disconnect', () => {
      for (const [roomId, game] of activeGames.entries()) {
        // Remove o socket.id do set de prontos (não mais o nome)
        game.prontos.delete(socket.id);
        game.players = game.players.filter(p => p.id !== socket.id);
        if (game.players.length === 0) {
          activeGames.delete(roomId);
        } else {
          const total = io.sockets.adapter.rooms.get(roomId)?.size || 0;
          io.to(roomId).emit('eventoJogo', { tipo: 'conectado', total });
        }
      }
      console.log('🚪 Desconectado:', socket.id);
    });
  });
};
