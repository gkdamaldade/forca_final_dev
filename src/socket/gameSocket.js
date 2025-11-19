const { getRandomWord } = require('../services/wordService');
const { Game } = require('../game');

const RECONNECT_GRACE_MS = 15000;
const activeGames = new Map();

module.exports = function(io) {
  io.on('connection', socket => {
    console.log('🎮 Conectado:', socket.id);

    socket.on('joinRoom', async ({ roomId, playerName, categoria }) => {
      console.log(`🚪 joinRoom recebido: roomId=${roomId}, playerName=${playerName}, categoria=${categoria}, socket.id=${socket.id}`);
      
      socket.join(roomId);
      socket.data = { nome: playerName, sala: roomId };
      
      console.log(`✅ Socket ${socket.id} entrou na sala ${roomId}`);
      
      if (!activeGames.has(roomId)) {
        try {
          // Busca palavra aleatória do banco filtrando por categoria
          const wordObj = await getRandomWord({ categoria: categoria });
          const palavra = (wordObj?.palavra || 'FORCA').toUpperCase();
          const categoriaUsada = wordObj?.categoria || categoria;
          
          const gameInstance = new Game(palavra, categoriaUsada);
          activeGames.set(roomId, {
            players: [],
            word: palavra,
            turno: 1,
            categoria: categoriaUsada,
            prontos: new Set(), // Armazena socket.id dos jogadores prontos
            gameInstance: gameInstance // Instância da classe Game para lógica do jogo
          });
        } catch (error) {
          console.error('Erro ao buscar palavra:', error);
          // Fallback caso não encontre palavra
          const gameInstance = new Game('FORCA', categoria || 'Geral');
          activeGames.set(roomId, {
            players: [],
            word: 'FORCA',
            turno: 1,
            categoria: categoria || 'Geral',
            prontos: new Set(), // Armazena socket.id dos jogadores prontos
            gameInstance: gameInstance
          });
        }
      }

      const game = activeGames.get(roomId);
      
      // Verifica se o jogador já está na lista pelo socket.id (reconexão com mesmo socket)
      const jogadorExistentePorSocket = game.players.find(p => p.id === socket.id);
      if (jogadorExistentePorSocket) {
        console.log(`🔄 Jogador ${jogadorExistentePorSocket.numero} (${playerName}, ${socket.id}) reconectou na sala ${roomId}`);
        // Atualiza o nome caso tenha mudado
        jogadorExistentePorSocket.name = playerName;
        jogadorExistentePorSocket.desconectado = false;
        if (jogadorExistentePorSocket.remocaoTimeout) {
          clearTimeout(jogadorExistentePorSocket.remocaoTimeout);
          jogadorExistentePorSocket.remocaoTimeout = null;
        }
        // Envia evento de preparação se necessário
        if (game.players.length === 2) {
          const j1 = game.players.find(p => p.numero === 1);
          const j2 = game.players.find(p => p.numero === 2);
          if (j1 && j2) {
            io.to(j1.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
            io.to(j2.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
          }
        }
        return;
      }
      
      // Verifica se há um jogador com o mesmo nome (reconexão com novo socket.id)
      const jogadorExistentePorNome = game.players.find(p => p.name === playerName);
      if (jogadorExistentePorNome && jogadorExistentePorNome.id !== socket.id) {
        const socketIdAntigo = jogadorExistentePorNome.id;
        console.log(`🔄 Jogador ${jogadorExistentePorNome.numero} (${playerName}) reconectou com novo socket: ${socketIdAntigo} -> ${socket.id}`);

        const estavaProntoAntes = jogadorExistentePorNome.wasReady || game.prontos.has(socketIdAntigo);

        // Remove o socket.id antigo do set de prontos
        game.prontos.delete(socketIdAntigo);

        // Desconecta o socket antigo para evitar conflitos
        const socketAntigo = io.sockets.sockets.get(socketIdAntigo);
        if (socketAntigo) {
          socketAntigo.leave(roomId);
          console.log(`🔌 Socket antigo ${socketIdAntigo} removido da sala`);
        }

        // Atualiza o socket.id do jogador
        jogadorExistentePorNome.id = socket.id;
        jogadorExistentePorNome.desconectado = false;
        jogadorExistentePorNome.wasReady = estavaProntoAntes;
        if (jogadorExistentePorNome.remocaoTimeout) {
          clearTimeout(jogadorExistentePorNome.remocaoTimeout);
          jogadorExistentePorNome.remocaoTimeout = null;
        }

        // Se o jogador já estava marcado como pronto, atualiza o set com o novo socket.id
        if (estavaProntoAntes) {
          game.prontos.add(socket.id);
          console.log(`✅ Jogador ${jogadorExistentePorNome.numero} (${playerName}) manteve estado de pronto após reconexão.`);
          console.log(`📊 Prontos atualizados: ${game.prontos.size}/2 -> IDs:`, Array.from(game.prontos));
        } else {
          console.log(`ℹ️ Jogador ${playerName} reconectou ainda não pronto.`);
        }

        // Envia evento de preparação se necessário
        if (game.players.length === 2) {
          const j1 = game.players.find(p => p.numero === 1);
          const j2 = game.players.find(p => p.numero === 2);
          if (j1 && j2) {
            io.to(j1.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
            io.to(j2.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
          }
        }
        return;
      }
      
      // Verifica se a sala já está cheia
      if (game.players.length >= 2) {
        console.warn(`⚠️ Sala ${roomId} já está cheia (${game.players.length} jogadores). Ignorando entrada de ${playerName} (${socket.id})`);
        socket.emit('eventoJogo', {
          tipo: 'erro',
          mensagem: 'Sala cheia! Apenas 2 jogadores podem jogar.'
        });
        return;
      }
      
      // Garante que o primeiro jogador seja sempre 1 e o segundo seja sempre 2
      const numeroJogador = game.players.length === 0 ? 1 : 2;
      
      // Verifica se já existe um jogador com esse número (proteção contra duplicatas)
      const jogadorComMesmoNumero = game.players.find(p => p.numero === numeroJogador);
      if (jogadorComMesmoNumero) {
        console.warn(`⚠️ Já existe um jogador com número ${numeroJogador}. Corrigindo números...`);
        // Corrige os números: primeiro jogador = 1, segundo = 2
        game.players.forEach((p, index) => {
          p.numero = index + 1;
        });
        console.log(`✅ Números corrigidos:`, game.players.map(p => `${p.name} (${p.id}) = ${p.numero}`));
      }
      
      game.players.push({ 
        id: socket.id, 
        name: playerName, 
        numero: numeroJogador,
        wasReady: false,
        desconectado: false,
        remocaoTimeout: null
      });
      console.log(`👤 Jogador ${numeroJogador} (${playerName}, ${socket.id}) entrou na sala ${roomId}. Total: ${game.players.length}`);
      
      // Validação final: garante que os números estão corretos
      if (game.players.length === 2) {
        const nums = game.players.map(p => p.numero).sort();
        if (nums[0] !== 1 || nums[1] !== 2) {
          console.error(`❌ Números inválidos detectados: ${nums}. Corrigindo...`);
          game.players[0].numero = 1;
          game.players[1].numero = 2;
          console.log(`✅ Números corrigidos para:`, game.players.map(p => `${p.name} = ${p.numero}`));
        }
      }

      const total = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      io.to(roomId).emit('eventoJogo', { tipo: 'conectado', total });

      console.log(`📊 Estado após entrada: ${game.players.length} jogadores na sala ${roomId}`);
      console.log(`📋 Lista de jogadores:`, game.players.map(p => `${p.name} (${p.id}) = ${p.numero}`));

      if (game.players.length === 2) {
        // Validação e correção dos números antes de continuar
        const nums = game.players.map(p => p.numero).sort();
        if (nums[0] !== 1 || nums[1] !== 2) {
          console.warn(`⚠️ Números inválidos antes de iniciar: ${nums}. Corrigindo...`);
          game.players[0].numero = 1;
          game.players[1].numero = 2;
          console.log(`✅ Números corrigidos:`, game.players.map(p => `${p.name} (${p.id}) = ${p.numero}`));
        }
        
        // Garante que j1 é sempre o jogador 1 e j2 é sempre o jogador 2
        const j1 = game.players.find(p => p.numero === 1);
        const j2 = game.players.find(p => p.numero === 2);
        
        if (!j1 || !j2) {
          console.error('❌ Erro: jogadores não encontrados corretamente após correção', game.players);
          // Tenta corrigir novamente usando a ordem do array
          game.players[0].numero = 1;
          game.players[1].numero = 2;
          const j1Corrigido = game.players[0];
          const j2Corrigido = game.players[1];
          console.log(`🔧 Usando correção de emergência: J1=${j1Corrigido.name}, J2=${j2Corrigido.name}`);
          
          // Continua com os jogadores corrigidos
          if (game.players.length === 2 && game.prontos.size === 2) {
            const estado = game.gameInstance.getEstado();
            game.turno = 1;
            
            console.log(`📤 Enviando evento 'inicio' para J1 (${j1Corrigido.id}): jogador=1, turno=${game.turno}`);
            io.to(j1Corrigido.id).emit('eventoJogo', { 
              tipo: 'inicio', 
              jogador: 1, 
              adversario: j2Corrigido.name, 
              palavra: estado.palavra,
              palavraSecreta: game.word,
              turno: game.turno, 
              categoria: game.categoria,
              meuSocketId: j1Corrigido.id,
              adversarioSocketId: j2Corrigido.id
            });
            
            console.log(`📤 Enviando evento 'inicio' para J2 (${j2Corrigido.id}): jogador=2, turno=${game.turno}`);
            io.to(j2Corrigido.id).emit('eventoJogo', { 
              tipo: 'inicio', 
              jogador: 2, 
              adversario: j1Corrigido.name, 
              palavra: estado.palavra,
              palavraSecreta: game.word,
              turno: game.turno, 
              categoria: game.categoria,
              meuSocketId: j2Corrigido.id,
              adversarioSocketId: j1Corrigido.id
            });
          } else {
            console.log(`⏳ Aguardando prontos: ${game.players.length} jogadores, ${game.prontos.size} prontos`);
            console.log(`📤 Enviando evento 'preparacao' para J1 (${j1Corrigido.id}) e J2 (${j2Corrigido.id})`);
            io.to(j1Corrigido.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
            io.to(j2Corrigido.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
          }
          return;
        }
        
        console.log(`👥 Dois jogadores na sala: J1=${j1.name} (${j1.id}, numero=${j1.numero}), J2=${j2.name} (${j2.id}, numero=${j2.numero})`);
        console.log(`📊 Prontos: ${game.prontos.size}/2`);
        console.log(`📋 IDs dos prontos:`, Array.from(game.prontos));
        console.log(`📋 IDs dos jogadores:`, game.players.map(p => p.id));
        
        // Verifica se ambos estão prontos ANTES de enviar eventos
        const ambosProntos = game.players.length === 2 && game.prontos.size === 2;
        const j1Pronto = game.prontos.has(j1.id);
        const j2Pronto = game.prontos.has(j2.id);
        
        console.log(`🔍 Verificação de prontos (joinRoom): ambosProntos=${ambosProntos}, j1Pronto=${j1Pronto}, j2Pronto=${j2Pronto}`);
        console.log(`📋 IDs dos prontos (joinRoom):`, Array.from(game.prontos));
        console.log(`📋 IDs dos jogadores (joinRoom):`, game.players.map(p => `${p.name} (${p.id})`));
        
        if (ambosProntos && j1Pronto && j2Pronto) {
          // Ambos estão prontos, inicia o jogo imediatamente
          console.log(`🎮 Ambos os jogadores estão prontos! Iniciando jogo...`);
          const estado = game.gameInstance.getEstado();
          game.turno = 1; // Garante que o turno inicial seja sempre 1
          
          console.log(`📤 Enviando evento 'inicio' para J1 (${j1.id}): jogador=1, turno=${game.turno}, palavra="${estado.palavra}"`);
          io.to(j1.id).emit('eventoJogo', { 
            tipo: 'inicio', 
            jogador: 1, 
            adversario: j2.name, 
            palavra: estado.palavra,
            palavraSecreta: game.word,
            turno: game.turno, 
            categoria: game.categoria,
            meuSocketId: j1.id,
            adversarioSocketId: j2.id
          });
          
          console.log(`📤 Enviando evento 'inicio' para J2 (${j2.id}): jogador=2, turno=${game.turno}, palavra="${estado.palavra}"`);
          io.to(j2.id).emit('eventoJogo', { 
            tipo: 'inicio', 
            jogador: 2, 
            adversario: j1.name, 
            palavra: estado.palavra,
            palavraSecreta: game.word,
            turno: game.turno, 
            categoria: game.categoria,
            meuSocketId: j2.id,
            adversarioSocketId: j1.id
          });
        } else {
          console.log(`⏳ Aguardando prontos: ${game.players.length} jogadores, ${game.prontos.size} prontos`);
          console.log(`📤 Enviando evento 'preparacao' para J1 (${j1.id}) e J2 (${j2.id})`);
          io.to(j1.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
          io.to(j2.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
        }
      } else if (game.players.length === 1) {
        console.log(`⏳ Aguardando segundo jogador na sala ${roomId}`);
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
        
        if (!jogadorAtual) {
          console.log(`⚠️ Jogador não encontrado ao marcar como pronto: ${socket.id}`);
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Jogador não encontrado na sala!'
          });
          return;
        }
        
        if (!game.prontos.has(socket.id)) {
          game.prontos.add(socket.id);
          jogadorAtual.wasReady = true;
          jogadorAtual.desconectado = false;
          if (jogadorAtual.remocaoTimeout) {
            clearTimeout(jogadorAtual.remocaoTimeout);
            jogadorAtual.remocaoTimeout = null;
          }
          console.log(`✅ Jogador ${jogadorAtual.numero} (${nomeJogador}, ${socket.id}) marcado como pronto. Total prontos: ${game.prontos.size}`);
        } else {
          console.log(`ℹ️ Jogador ${jogadorAtual.numero} (${nomeJogador}, ${socket.id}) já estava pronto. Total prontos: ${game.prontos.size}`);
        }

        // Envia evento para TODOS na sala informando quem está pronto
        io.to(roomId).emit('eventoJogo', {
          tipo: 'pronto',
          nome: nomeJogador,
          socketId: socket.id, // Inclui o socket.id para identificação única
          total: game.prontos.size
        });

        console.log(`📊 Estado da sala ${roomId}: ${game.players.length} jogadores, ${game.prontos.size} prontos`);
        console.log(`📋 IDs dos jogadores:`, game.players.map(p => `${p.name} (${p.id}, numero=${p.numero})`));
        console.log(`📋 IDs dos prontos:`, Array.from(game.prontos));
        console.log(`🔍 Verificando condição para iniciar: players.length=${game.players.length} === 2? ${game.players.length === 2}, prontos.size=${game.prontos.size} === 2? ${game.prontos.size === 2}`);

        // Quando ambos estiverem prontos, iniciar o jogo
        if (game.players.length === 2 && game.prontos.size === 2) {
          console.log(`✅ CONDIÇÃO SATISFEITA! Iniciando jogo...`);
          // Validação e correção dos números antes de iniciar
          const nums = game.players.map(p => p.numero).sort();
          if (nums[0] !== 1 || nums[1] !== 2) {
            console.warn(`⚠️ Números inválidos antes de iniciar jogo: ${nums}. Corrigindo...`);
            game.players[0].numero = 1;
            game.players[1].numero = 2;
            console.log(`✅ Números corrigidos:`, game.players.map(p => `${p.name} (${p.id}) = ${p.numero}`));
          }
          
          // Garante que j1 é sempre o jogador 1 e j2 é sempre o jogador 2
          const j1 = game.players.find(p => p.numero === 1);
          const j2 = game.players.find(p => p.numero === 2);
          
          if (!j1 || !j2) {
            console.error('❌ Erro: jogadores não encontrados corretamente ao iniciar jogo', game.players);
            // Correção de emergência
            game.players[0].numero = 1;
            game.players[1].numero = 2;
            const j1Corrigido = game.players[0];
            const j2Corrigido = game.players[1];
            console.log(`🔧 Usando correção de emergência: J1=${j1Corrigido.name}, J2=${j2Corrigido.name}`);
            
            const estado = game.gameInstance.getEstado();
            game.turno = 1;
            
            console.log(`📤 Enviando evento 'inicio' para J1 (${j1Corrigido.id}): jogador=1, turno=${game.turno}`);
            io.to(j1Corrigido.id).emit('eventoJogo', {
              tipo: 'inicio',
              jogador: 1,
              adversario: j2Corrigido.name,
              palavra: estado.palavra,
              palavraSecreta: game.word,
              turno: game.turno,
              categoria: game.categoria,
              meuSocketId: j1Corrigido.id,
              adversarioSocketId: j2Corrigido.id
            });

            console.log(`📤 Enviando evento 'inicio' para J2 (${j2Corrigido.id}): jogador=2, turno=${game.turno}`);
            io.to(j2Corrigido.id).emit('eventoJogo', {
              tipo: 'inicio',
              jogador: 2,
              adversario: j1Corrigido.name,
              palavra: estado.palavra,
              palavraSecreta: game.word,
              turno: game.turno,
              categoria: game.categoria,
              meuSocketId: j2Corrigido.id,
              adversarioSocketId: j1Corrigido.id
            });
            return;
          }
          
          const estado = game.gameInstance.getEstado();
          
          // Garante que o turno inicial seja sempre 1 (jogador 1 começa)
          game.turno = 1;
          
          console.log(`🎮 Iniciando jogo na sala ${roomId}`);
          console.log(`Jogador 1: ${j1.name} (${j1.id}, numero: ${j1.numero}), Jogador 2: ${j2.name} (${j2.id}, numero: ${j2.numero})`);
          console.log(`Turno inicial: ${game.turno}`);
          console.log(`Palavra secreta: ${game.word}, Palavra exibida: ${estado.palavra}`);

          // Verifica se os sockets ainda estão conectados
          const j1Socket = io.sockets.sockets.get(j1.id);
          const j2Socket = io.sockets.sockets.get(j2.id);
          
          if (!j1Socket) {
            console.error(`❌ Socket J1 (${j1.id}) não está mais conectado!`);
          }
          if (!j2Socket) {
            console.error(`❌ Socket J2 (${j2.id}) não está mais conectado!`);
          }

          const eventoInicioJ1 = {
            tipo: 'inicio',
            jogador: 1,
            adversario: j2.name,
            palavra: estado.palavra, // Palavra oculta para exibição
            palavraSecreta: game.word, // Palavra completa (para lógica)
            turno: game.turno, // Sempre 1 no início
            categoria: game.categoria,
            meuSocketId: j1.id, // Socket ID deste jogador para identificação única
            adversarioSocketId: j2.id // Socket ID do adversário
          };
          
          const eventoInicioJ2 = {
            tipo: 'inicio',
            jogador: 2,
            adversario: j1.name,
            palavra: estado.palavra, // Palavra oculta para exibição
            palavraSecreta: game.word, // Palavra completa (para lógica)
            turno: game.turno, // Sempre 1 no início
            categoria: game.categoria,
            meuSocketId: j2.id, // Socket ID deste jogador para identificação única
            adversarioSocketId: j1.id // Socket ID do adversário
          };

          console.log(`📤 Enviando evento 'inicio' para J1 (${j1.id}):`, eventoInicioJ1);
          io.to(j1.id).emit('eventoJogo', eventoInicioJ1);

          console.log(`📤 Enviando evento 'inicio' para J2 (${j2.id}):`, eventoInicioJ2);
          io.to(j2.id).emit('eventoJogo', eventoInicioJ2);
          
          // Verifica se os eventos foram enviados corretamente
          console.log(`✅ Eventos 'inicio' enviados para ambos os jogadores`);
        } else {
          console.log(`⏳ Condição NÃO satisfeita: players.length=${game.players.length}, prontos.size=${game.prontos.size}`);
          console.log(`📋 Esperando mais jogadores ou prontos...`);
        }
      }

      if (msg.tipo === 'jogada') {
        // Verifica se é o turno do jogador
        const jogadorAtual = game.players.find(p => p.id === socket.id);
        if (!jogadorAtual) {
          console.log(`❌ Jogador não encontrado: ${socket.id}`);
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Jogador não encontrado na sala!'
          });
          return;
        }
        
        // Usa o número do jogador armazenado (mais confiável que indexOf)
        const numeroJogador = jogadorAtual.numero;
        
        console.log(`🎯 Verificando turno: jogador=${numeroJogador}, turno atual=${game.turno}`);
        
        if (numeroJogador !== game.turno) {
          // Não é o turno deste jogador
          console.log(`❌ Não é o turno do jogador ${numeroJogador}. Turno atual: ${game.turno}`);
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Não é seu turno!'
          });
          return;
        }
        
        console.log(`✅ É o turno do jogador ${numeroJogador}. Processando jogada...`);

        // Processa a jogada usando a classe Game
        const resultado = game.gameInstance.chutarLetra(msg.letra);
        const estado = game.gameInstance.getEstado();
        
        console.log(`Jogada processada: letra=${msg.letra}, resultado=${resultado}, turno atual=${game.turno}`);
        
        // Se a jogada foi válida (não repetida) e o jogo continua, troca o turno
        if (resultado !== 'repetida' && game.gameInstance.status === 'jogando') {
          game.turno = game.turno === 1 ? 2 : 1;
          console.log(`Turno trocado para: ${game.turno}`);
        }

        // Envia o resultado para todos na sala
        io.to(roomId).emit('eventoJogo', {
          tipo: 'jogada',
          letra: msg.letra,
          resultado: resultado, // 'acerto', 'erro', 'vitoria', 'derrota', 'repetida'
          palavra: estado.palavra,
          erros: estado.erros,
          letrasChutadas: estado.letrasChutadas,
          turno: game.turno,
          status: estado.status
        });

        // Se o jogo acabou, limpa a sala
        if (estado.status === 'vitoria' || estado.status === 'derrota') {
          setTimeout(() => {
            activeGames.delete(roomId);
          }, 5000);
        }
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
      console.log('🚪 Desconectado:', socket.id);
      for (const [roomId, game] of activeGames.entries()) {
        const jogador = game.players.find(p => p.id === socket.id);
        if (!jogador) {
          continue;
        }

        const estavaPronto = game.prontos.has(socket.id) || jogador.wasReady;
        game.prontos.delete(socket.id);
        jogador.wasReady = estavaPronto;
        jogador.desconectado = true;
        jogador.desconectadoEm = Date.now();

        if (jogador.remocaoTimeout) {
          clearTimeout(jogador.remocaoTimeout);
        }

        const socketIdParaRemocao = socket.id;
        jogador.remocaoTimeout = setTimeout(() => {
          const aindaExiste = game.players.find(p => p.name === jogador.name);
          if (!aindaExiste || !aindaExiste.desconectado || aindaExiste.id !== socketIdParaRemocao) {
            return; // Jogador já reconectou ou foi removido
          }

          console.log(`🗑️ Removendo jogador ${jogador.name} da sala ${roomId} após ${RECONNECT_GRACE_MS / 1000}s desconectado`);
          game.players = game.players.filter(p => p.name !== jogador.name);

          if (game.players.length === 0) {
            console.log(`🧹 Nenhum jogador restante na sala ${roomId}. Removendo jogo ativo.`);
            activeGames.delete(roomId);
          } else {
            const totalAtual = io.sockets.adapter.rooms.get(roomId)?.size || 0;
            io.to(roomId).emit('eventoJogo', { tipo: 'conectado', total: totalAtual });
          }
        }, RECONNECT_GRACE_MS);

        const total = io.sockets.adapter.rooms.get(roomId)?.size || 0;
        io.to(roomId).emit('eventoJogo', { tipo: 'conectado', total });

        console.log(`⚠️ Jogador ${jogador.name} (${socket.id}) desconectou. Aguardando reconexão por ${RECONNECT_GRACE_MS / 1000}s`);
      }
    });
  });
};
