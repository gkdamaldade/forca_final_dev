const { getRandomWord } = require('../services/wordService');
const { Game } = require('../game');
const { models } = require('../models');

// Função centralizada para finalizar o jogo e registrar vitória
async function finalizarJogo(game, vencedorNum, motivo = 'normal') {
  // Verifica se o jogo já foi finalizado (evita duplicação)
  if (game.finalizado) {
    console.log(`⚠️ Jogo já foi finalizado anteriormente. Ignorando tentativa de finalização.`);
    return null;
  }
  
  // Marca o jogo como finalizado
  game.finalizado = true;
  
  console.log(`🏆 Finalizando jogo! Vencedor: Jogador ${vencedorNum}, Motivo: ${motivo}`);
  
  // Registra vitória APENAS para o vencedor no banco de dados
  try {
    const jogadorVencedor = game.players.find(p => p.numero === vencedorNum);
    const jogadorPerdedor = game.players.find(p => p.numero !== vencedorNum);
    
    if (jogadorVencedor && jogadorVencedor.playerId) {
      const playerVencedor = await models.Player.findByPk(jogadorVencedor.playerId);
      if (playerVencedor) {
        // Calcula recompensas: 20 moedas pela vitória + aposta do perdedor (que ele ganha)
        // A aposta do vencedor não é adicionada porque ele já tem essas moedas (apenas não foram subtraídas ainda)
        const apostaVencedor = game.apostas[vencedorNum] || 0;
        const apostaPerdedor = jogadorPerdedor ? (game.apostas[jogadorPerdedor.numero] || 0) : 0;
        const moedasGanhas = 20 + apostaPerdedor; // Vencedor ganha apenas a aposta do perdedor (sua própria aposta já é dele)
        
        // Incrementa vitórias e moedas
        await playerVencedor.increment({ 
          vitorias: 1, 
          moedas: moedasGanhas 
        });
        await playerVencedor.reload();
        console.log(`✅ Vitória registrada para ${jogadorVencedor.name} (ID: ${jogadorVencedor.playerId})! Total de vitórias: ${playerVencedor.vitorias}, Moedas ganhas: ${moedasGanhas} (20 vitória + ${apostaPerdedor} aposta adversário), Total de moedas: ${playerVencedor.moedas}`);
      } else {
        console.warn(`⚠️ Jogador com ID ${jogadorVencedor.playerId} não encontrado no banco de dados.`);
      }
    } else {
      console.warn(`⚠️ Jogador vencedor não encontrado ou sem playerId no game.players`);
    }
    
    // Processa perda de moedas do perdedor
    if (jogadorPerdedor && jogadorPerdedor.playerId) {
      const playerPerdedor = await models.Player.findByPk(jogadorPerdedor.playerId);
      if (playerPerdedor) {
        const apostaPerdedor = game.apostas[jogadorPerdedor.numero] || 0;
        if (apostaPerdedor > 0) {
          // Decrementa as moedas apostadas
          const moedasAtuais = playerPerdedor.moedas || 0;
          const novasMoedas = Math.max(0, moedasAtuais - apostaPerdedor);
          await playerPerdedor.update({ moedas: novasMoedas });
          console.log(`💸 Perdedor ${jogadorPerdedor.name} perdeu ${apostaPerdedor} moedas da aposta. Moedas anteriores: ${moedasAtuais}, Moedas atuais: ${novasMoedas}`);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Erro ao registrar vitória:`, error);
    // Não bloqueia o fim do jogo se houver erro ao registrar vitória
  }
  
  // Retorna o evento de fim de jogo para ser enviado
  return {
    tipo: 'fim',
    vencedor: vencedorNum,
    motivo: motivo,
    vidas: game.vidas
  };
}

const RECONNECT_GRACE_MS = 20000; // 20 segundos para reconectar
const activeGames = new Map();

// Sistema de logging condicional (desabilitado em produção)
const DEBUG = process.env.NODE_ENV !== 'production';
const log = DEBUG ? console.log.bind(console) : () => {};
const logWarn = DEBUG ? console.warn.bind(console) : () => {};
const logError = console.error.bind(console); // Erros sempre logados

module.exports = function(io) {
  io.on('connection', socket => {
    log('🎮 Conectado:', socket.id);

    socket.on('joinRoom', async ({ roomId, playerName, playerId, categoria }) => {
      log(`🚪 joinRoom recebido: roomId=${roomId}, playerName=${playerName}, playerId=${playerId}, categoria=${categoria}, socket.id=${socket.id}`);
      
      socket.join(roomId);
      socket.data = { nome: playerName, playerId: playerId, sala: roomId };
      
      log(`✅ Socket ${socket.id} entrou na sala ${roomId}`);
      
      if (!activeGames.has(roomId)) {
        try {
          // Busca primeira palavra aleatória
          const wordObj1 = await getRandomWord({ categoria: categoria, excluirPalavras: [] });
          const palavra1 = (wordObj1?.palavra || 'FORCA').toUpperCase();
          const categoriaUsada = wordObj1?.categoria || categoria;
          const dificuldade = wordObj1?.dificuldade || null; // Pega a dificuldade da primeira palavra
          
          // Busca segunda palavra com a MESMA dificuldade e excluindo a primeira (garante que sejam diferentes mas com mesma dificuldade)
          let wordObj2;
          let palavra2;
          let tentativas = 0;
          
          // Tenta encontrar palavra com a mesma dificuldade
          if (dificuldade) {
            do {
              try {
                wordObj2 = await getRandomWord({ 
                  categoria: categoria, 
                  excluirPalavras: [palavra1],
                  dificuldade: dificuldade // Usa a mesma dificuldade da primeira palavra
                });
                
                if (wordObj2) {
            palavra2 = (wordObj2?.palavra || 'FORCA').toUpperCase();
                  // Se encontrou palavra diferente, sai do loop
                  if (palavra1 !== palavra2) {
                    break;
                  }
                }
              } catch (error) {
                // Se não encontrou palavra com essa dificuldade, tenta sem filtro
                console.warn(`⚠️ Não foi possível encontrar palavra com dificuldade ${dificuldade}. Tentando sem filtro...`);
                wordObj2 = null;
                break;
              }
            tentativas++;
            } while (palavra1 === palavra2 && tentativas < 5);
          }
          
          // Se não encontrou palavra com a mesma dificuldade, tenta sem filtro de dificuldade (fallback)
          if (!wordObj2) {
            if (dificuldade) {
              console.warn(`⚠️ Não foi possível encontrar palavra com dificuldade ${dificuldade}. Buscando sem filtro de dificuldade...`);
            }
            wordObj2 = await getRandomWord({ categoria: categoria, excluirPalavras: [palavra1] });
            palavra2 = (wordObj2?.palavra || 'FORCA').toUpperCase();
          }
          
          // Cria instâncias de Game separadas para cada jogador
          const gameInstance1 = new Game(palavra1, categoriaUsada);
          const gameInstance2 = new Game(palavra2, categoriaUsada);
          
          // Extrai as dicas das palavras (ordem 1, 2, 3)
          const dicasJogador1 = wordObj1?.dicas || [];
          const dicasJogador2 = wordObj2?.dicas || [];
          
          activeGames.set(roomId, {
            players: [],
            words: [palavra1, palavra2], // Palavras para cada jogador
            palavrasUsadas: [palavra1, palavra2], // Rastreia todas as palavras já usadas no jogo
            dicas: [dicasJogador1, dicasJogador2], // Dicas para cada jogador (ordem 1, 2, 3)
            turno: 1,
            turnoInicialRodada: 1, // Salva qual jogador começou a rodada atual
            categoria: categoriaUsada,
            finalizado: false, // Flag para evitar finalização duplicada
            prontos: new Set(),
            gameInstances: [gameInstance1, gameInstance2], // Uma instância por jogador
            vidas: [3, 3], // Cada jogador começa com 3 vidas
            palpiteAtivo: { 1: false, 2: false }, // Rastreia se o poder de palpite está ativo para cada jogador
            jogoIniciado: false, // Flag para indicar se o jogo realmente começou (ambos clicaram em "pronto")
            apostas: { 1: 0, 2: 0 }, // Apostas de cada jogador (inicialmente 0)
            dicaBloqueada: { 1: false, 2: false } // Rastreia se a próxima dica está bloqueada para cada jogador
          });
        } catch (error) {
          console.error('Erro ao buscar palavras:', error);
          // Fallback caso não encontre palavras
          const gameInstance1 = new Game('FORCA', categoria || 'Geral');
          const gameInstance2 = new Game('JOGO', categoria || 'Geral');
          activeGames.set(roomId, {
            players: [],
            words: ['FORCA', 'JOGO'],
            palavrasUsadas: ['FORCA', 'JOGO'], // Rastreia todas as palavras já usadas no jogo
            dicas: [[], []], // Sem dicas no fallback
            turno: 1,
            turnoInicialRodada: 1, // Salva qual jogador começou a rodada atual
            categoria: categoria || 'Geral',
            prontos: new Set(),
            gameInstances: [gameInstance1, gameInstance2],
            vidas: [3, 3],
            palpiteAtivo: { 1: false, 2: false },
            jogoIniciado: false, // Flag para indicar se o jogo realmente começou (ambos clicaram em "pronto")
            apostas: { 1: 0, 2: 0 }, // Apostas de cada jogador (inicialmente 0)
            dicaBloqueada: { 1: false, 2: false } // Rastreia se a próxima dica está bloqueada para cada jogador
          });
        }
      }

      const game = activeGames.get(roomId);
      if (!game.palpiteAtivo) {
        game.palpiteAtivo = { 1: false, 2: false };
      }
      // Garante que palavrasUsadas existe (para jogos criados antes dessa atualização)
      if (!game.palavrasUsadas) {
        game.palavrasUsadas = game.words ? [...game.words] : [];
      }
      // Garante que dicas existe (para jogos criados antes dessa atualização)
      if (!game.dicas) {
        game.dicas = [[], []];
      }
      // Garante que dicasPedidas existe (para jogos criados antes dessa atualização)
      if (!game.dicasPedidas) {
        game.dicasPedidas = [0, 0]; // Inicializa contador de dicas pedidas
      }
      // Garante que jogoIniciado existe (para jogos criados antes dessa atualização)
      if (game.jogoIniciado === undefined) {
        game.jogoIniciado = false; // Inicializa como false
      }
      // Garante que dicaBloqueada existe (para jogos criados antes dessa atualização)
      if (!game.dicaBloqueada) {
        game.dicaBloqueada = { 1: false, 2: false };
      }
      
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
        
        // Notifica que o jogador reconectou
        io.to(roomId).emit('eventoJogo', {
          tipo: 'jogadorReconectado',
          jogadorReconectado: jogadorExistentePorSocket.numero
        });
        
        // Verifica se o jogo está ativo (já começou)
        // O jogo só está ativo se ambos os jogadores clicaram em "pronto"
        // Não podemos confiar no status das instâncias porque elas são criadas com status 'jogando' desde o início
        const jogoEstaAtivo = game.jogoIniciado === true;
        
        if (jogoEstaAtivo) {
          // Jogo está em andamento - envia estado COMPLETO do jogo para o jogador que reconectou
          console.log(`🔄 Jogo está ativo. Enviando estado COMPLETO para jogador ${jogadorExistentePorSocket.numero}`);
          const j1 = game.players.find(p => p.numero === 1);
          const j2 = game.players.find(p => p.numero === 2);
          
          if (j1 && j2 && game.gameInstances[0] && game.gameInstances[1]) {
            const estado1 = game.gameInstances[0].getEstado();
            const estado2 = game.gameInstances[1].getEstado();
            
            // Envia estado COMPLETO para o jogador que reconectou (incluindo letras chutadas e erros)
            const eventoReconexao = {
              tipo: 'inicio',
              jogador: jogadorExistentePorSocket.numero,
              adversario: jogadorExistentePorSocket.numero === 1 ? j2.name : j1.name,
              palavra: jogadorExistentePorSocket.numero === 1 ? estado1.palavra : estado2.palavra,
              palavraAdversario: jogadorExistentePorSocket.numero === 1 ? estado2.palavra : estado1.palavra,
              palavraSecreta: game.words[jogadorExistentePorSocket.numero - 1],
              turno: game.turno,
              categoria: game.categoria,
              meuSocketId: jogadorExistentePorSocket.id,
              adversarioSocketId: jogadorExistentePorSocket.numero === 1 ? j2.id : j1.id,
              vidas: game.vidas,
              poderes: jogadorExistentePorSocket.poderes || [],
              dicas: game.dicas ? game.dicas[jogadorExistentePorSocket.numero - 1] : [],
              // Informações adicionais para restaurar estado completo
              errosJogador1: estado1.erros,
              errosJogador2: estado2.erros,
              letrasChutadasJogador1: Array.from(estado1.letrasChutadas),
              letrasChutadasJogador2: Array.from(estado2.letrasChutadas),
              statusJogador1: estado1.status,
              statusJogador2: estado2.status,
              reconexao: true // Flag para indicar que é uma reconexão
            };
            
            io.to(jogadorExistentePorSocket.id).emit('eventoJogo', eventoReconexao);
            console.log(`✅ Estado COMPLETO do jogo enviado para jogador ${jogadorExistentePorSocket.numero} após reconexão`);
            console.log(`📋 Estado enviado: vidas=${JSON.stringify(game.vidas)}, turno=${game.turno}, erros J1=${estado1.erros}, erros J2=${estado2.erros}`);
          }
        } else {
          // Jogo ainda não começou - envia evento de preparação
        if (game.players.length === 2) {
          const j1 = game.players.find(p => p.numero === 1);
          const j2 = game.players.find(p => p.numero === 2);
          if (j1 && j2) {
            io.to(j1.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
            io.to(j2.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
            }
          }
        }
        return;
      }
      
      // Verifica se há um jogador com o mesmo nome OU playerId (reconexão com novo socket.id)
      // Prioriza playerId se fornecido, depois nome
      let jogadorExistentePorNome = null;
      if (playerId) {
        jogadorExistentePorNome = game.players.find(p => p.playerId === playerId && p.playerId !== null);
      }
      if (!jogadorExistentePorNome) {
        jogadorExistentePorNome = game.players.find(p => p.name === playerName);
      }
      
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

        // Atualiza o socket.id do jogador e preserva TODOS os dados
        jogadorExistentePorNome.id = socket.id;
        jogadorExistentePorNome.desconectado = false;
        jogadorExistentePorNome.wasReady = estavaProntoAntes;
        // Atualiza playerId caso tenha mudado (mas mantém o mesmo jogador)
        if (playerId && playerId !== jogadorExistentePorNome.playerId) {
          console.log(`🔄 Atualizando playerId de ${jogadorExistentePorNome.playerId} para ${playerId}`);
          jogadorExistentePorNome.playerId = playerId;
        }
        // Atualiza nome caso tenha mudado
        if (playerName !== jogadorExistentePorNome.name) {
          console.log(`🔄 Atualizando nome de "${jogadorExistentePorNome.name}" para "${playerName}"`);
          jogadorExistentePorNome.name = playerName;
        }
        if (jogadorExistentePorNome.remocaoTimeout) {
          clearTimeout(jogadorExistentePorNome.remocaoTimeout);
          jogadorExistentePorNome.remocaoTimeout = null;
        }
        
        // Notifica que o jogador reconectou
        io.to(roomId).emit('eventoJogo', {
          tipo: 'jogadorReconectado',
          jogadorReconectado: jogadorExistentePorNome.numero
        });

        // Se o jogador já estava marcado como pronto, atualiza o set com o novo socket.id
        if (estavaProntoAntes) {
          game.prontos.add(socket.id);
          console.log(`✅ Jogador ${jogadorExistentePorNome.numero} (${playerName}) manteve estado de pronto após reconexão.`);
          console.log(`📊 Prontos atualizados: ${game.prontos.size}/2 -> IDs:`, Array.from(game.prontos));
        } else {
          console.log(`ℹ️ Jogador ${playerName} reconectou ainda não pronto.`);
        }

        // Verifica se o jogo está ativo (já começou)
        // O jogo só está ativo se ambos os jogadores clicaram em "pronto"
        // Não podemos confiar no status das instâncias porque elas são criadas com status 'jogando' desde o início
        const jogoEstaAtivo = game.jogoIniciado === true;
        
        if (jogoEstaAtivo) {
          // Jogo está em andamento - envia estado COMPLETO do jogo para o jogador que reconectou
          console.log(`🔄 Jogo está ativo. Enviando estado COMPLETO para jogador ${jogadorExistentePorNome.numero}`);
          const j1 = game.players.find(p => p.numero === 1);
          const j2 = game.players.find(p => p.numero === 2);
          
          if (j1 && j2 && game.gameInstances[0] && game.gameInstances[1]) {
            const estado1 = game.gameInstances[0].getEstado();
            const estado2 = game.gameInstances[1].getEstado();
            
            // Envia estado COMPLETO para o jogador que reconectou (incluindo letras chutadas e erros)
            const eventoReconexao = {
              tipo: 'inicio',
              jogador: jogadorExistentePorNome.numero,
              adversario: jogadorExistentePorNome.numero === 1 ? j2.name : j1.name,
              palavra: jogadorExistentePorNome.numero === 1 ? estado1.palavra : estado2.palavra,
              palavraAdversario: jogadorExistentePorNome.numero === 1 ? estado2.palavra : estado1.palavra,
              palavraSecreta: game.words[jogadorExistentePorNome.numero - 1],
              turno: game.turno,
              categoria: game.categoria,
              meuSocketId: jogadorExistentePorNome.id,
              adversarioSocketId: jogadorExistentePorNome.numero === 1 ? j2.id : j1.id,
              vidas: game.vidas,
              poderes: jogadorExistentePorNome.poderes || [],
              dicas: game.dicas ? game.dicas[jogadorExistentePorNome.numero - 1] : [],
              // Informações adicionais para restaurar estado completo
              errosJogador1: estado1.erros,
              errosJogador2: estado2.erros,
              letrasChutadasJogador1: Array.from(estado1.letrasChutadas),
              letrasChutadasJogador2: Array.from(estado2.letrasChutadas),
              statusJogador1: estado1.status,
              statusJogador2: estado2.status,
              reconexao: true // Flag para indicar que é uma reconexão
            };
            
            io.to(jogadorExistentePorNome.id).emit('eventoJogo', eventoReconexao);
            console.log(`✅ Estado COMPLETO do jogo enviado para jogador ${jogadorExistentePorNome.numero} após reconexão`);
            console.log(`📋 Estado enviado: vidas=${JSON.stringify(game.vidas)}, turno=${game.turno}, erros J1=${estado1.erros}, erros J2=${estado2.erros}`);
          }
        } else {
          // Jogo ainda não começou - envia evento de preparação
        if (game.players.length === 2) {
          const j1 = game.players.find(p => p.numero === 1);
          const j2 = game.players.find(p => p.numero === 2);
          if (j1 && j2) {
            io.to(j1.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
            io.to(j2.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
            }
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
        playerId: playerId || null, // ID do jogador no banco de dados
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
          
          // NUNCA inicia o jogo automaticamente quando o segundo jogador entra
          // O jogo só deve iniciar quando ambos clicarem em "pronto" (evento 'pronto')
          // Limpa o set de prontos para garantir que ambos precisem clicar em "pronto" novamente
          console.log(`⏳ Limpando estado de prontos para garantir que ambos cliquem em "pronto" novamente`);
          game.prontos.clear();
          game.players.forEach(p => p.wasReady = false);
          
            console.log(`📤 Enviando evento 'preparacao' para J1 (${j1Corrigido.id}) e J2 (${j2Corrigido.id})`);
            io.to(j1Corrigido.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
            io.to(j2Corrigido.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
          return;
        }
        
        console.log(`👥 Dois jogadores na sala: J1=${j1.name} (${j1.id}, numero=${j1.numero}), J2=${j2.name} (${j2.id}, numero=${j2.numero})`);
        console.log(`📊 Prontos antes de limpar: ${game.prontos.size}/2`);
        console.log(`📋 IDs dos prontos:`, Array.from(game.prontos));
        console.log(`📋 IDs dos jogadores:`, game.players.map(p => p.id));
        
        // SEMPRE limpa o estado de prontos quando o segundo jogador entra
        // Isso garante que ambos precisem clicar em "pronto" novamente, mesmo se houver estado residual
        console.log(`⏳ Limpando estado de prontos para garantir que ambos cliquem em "pronto" novamente`);
        game.prontos.clear();
        game.players.forEach(p => p.wasReady = false);
        
        // SEMPRE envia evento de preparação quando o segundo jogador entra
        // O jogo só deve iniciar quando ambos clicarem em "pronto" (evento 'pronto')
        console.log(`⏳ Aguardando ambos os jogadores clicarem em "pronto": ${game.players.length} jogadores, ${game.prontos.size} prontos`);
          console.log(`📤 Enviando evento 'preparacao' para J1 (${j1.id}) e J2 (${j2.id})`);
          io.to(j1.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
          io.to(j2.id).emit('eventoJogo', { tipo: 'preparacao', categoria: game.categoria });
      } else if (game.players.length === 1) {
        console.log(`⏳ Aguardando segundo jogador na sala ${roomId}`);
      }
    });

    socket.on('eventoJogo', async msg => {
      const roomId = [...socket.rooms].find(r => r !== socket.id);
      const game = activeGames.get(roomId);
      if (!game) return;

      if (msg.tipo === 'pronto') {
        // Usa o nome do socket.data (mais confiável que msg.nome do cliente)
        const nomeJogador = socket.data?.nome || msg.nome;
        const poderesSelecionados = msg.poderes || []; // Array de poderes selecionados
        const aposta = parseInt(msg.aposta) || 0; // Valor da aposta (padrão 0)
        
        console.log(`📥 Evento 'pronto' recebido: socket.id=${socket.id}, nome=${nomeJogador}, roomId=${roomId}`);
        console.log(`🎯 Poderes selecionados:`, poderesSelecionados);
        console.log(`💰 Aposta: ${aposta} moedas`);
        console.log(`📋 Jogadores na sala:`, game.players.map(p => `${p.name} (${p.id})`));
        console.log(`📋 IDs dos prontos atuais:`, Array.from(game.prontos));
        
        // Adiciona o socket.id ao set de prontos (identificador único)
        // Isso evita problemas se dois jogadores tiverem o mesmo nome
        const jogadorAtual = game.players.find(p => p.id === socket.id);
        
        if (!jogadorAtual) {
          console.error(`❌ ERRO: Jogador não encontrado ao marcar como pronto!`);
          console.error(`   Socket ID: ${socket.id}`);
          console.error(`   Nome: ${nomeJogador}`);
          console.error(`   Sala: ${roomId}`);
          console.error(`   Jogadores na sala:`, game.players);
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Jogador não encontrado na sala!'
          });
          return;
        }
        
        // Valida poderes selecionados (máximo 3)
        if (poderesSelecionados.length > 3) {
          console.warn(`⚠️ Jogador ${jogadorAtual.numero} enviou ${poderesSelecionados.length} poderes (máximo 3). Apenas os 3 primeiros serão considerados.`);
          poderesSelecionados.splice(3);
        }
        
        // Armazena os poderes selecionados no objeto do jogador
        jogadorAtual.poderes = poderesSelecionados;
        console.log(`💾 Poderes do jogador ${jogadorAtual.numero} armazenados:`, jogadorAtual.poderes);
        
        // Valida e armazena a aposta
        if (aposta >= 0 && jogadorAtual.playerId) {
          try {
            const player = await models.Player.findByPk(jogadorAtual.playerId);
            if (player) {
              const moedasAtuais = player.moedas || 0;
              if (aposta > moedasAtuais) {
                console.warn(`⚠️ Jogador ${jogadorAtual.numero} tentou apostar ${aposta} mas só tem ${moedasAtuais} moedas. Ajustando para ${moedasAtuais}.`);
                game.apostas[jogadorAtual.numero] = moedasAtuais;
              } else {
                game.apostas[jogadorAtual.numero] = aposta;
              }
              console.log(`💰 Aposta do jogador ${jogadorAtual.numero} definida: ${game.apostas[jogadorAtual.numero]} moedas`);
            }
          } catch (error) {
            console.error(`❌ Erro ao validar aposta:`, error);
            game.apostas[jogadorAtual.numero] = 0; // Em caso de erro, define como 0
          }
        } else {
          game.apostas[jogadorAtual.numero] = aposta >= 0 ? aposta : 0;
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

        // SEMPRE envia evento para TODOS na sala informando quem está pronto
        // Isso garante que o contador seja atualizado mesmo se o jogador já estava pronto
        // NOTA: Não envia os poderes selecionados para outros jogadores (privacidade)
        const eventoPronto = {
          tipo: 'pronto',
          nome: nomeJogador,
          socketId: socket.id, // Inclui o socket.id para identificação única
          total: game.prontos.size,
          aposta: game.apostas[jogadorAtual.numero] // Inclui a aposta do jogador
          // NÃO inclui poderes aqui - cada jogador só sabe seus próprios poderes
        };
        
        console.log(`📤 Enviando evento 'pronto' para TODOS na sala ${roomId}:`, eventoPronto);
        io.to(roomId).emit('eventoJogo', eventoPronto);
        console.log(`✅ Evento 'pronto' enviado. Total na sala: ${io.sockets.adapter.rooms.get(roomId)?.size || 0} sockets`);

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
            
            const estado1 = game.gameInstances[0].getEstado();
            const estado2 = game.gameInstances[1].getEstado();
            game.turno = 1;
            game.turnoInicialRodada = 1; // Primeira rodada sempre começa com jogador 1
            game.jogoIniciado = true; // Marca que o jogo realmente começou
            
            console.log(`📤 Enviando evento 'inicio' para J1 (${j1Corrigido.id}): jogador=1, turno=${game.turno}`);
            io.to(j1Corrigido.id).emit('eventoJogo', {
              tipo: 'inicio',
              jogador: 1,
              adversario: j2Corrigido.name,
              palavra: estado1.palavra,
              palavraAdversario: estado2.palavra,
              palavraSecreta: game.words[0],
              turno: game.turno,
              categoria: game.categoria,
              meuSocketId: j1Corrigido.id,
              adversarioSocketId: j2Corrigido.id,
              vidas: game.vidas,
              poderes: j1Corrigido.poderes || [],
              dicas: game.dicas ? game.dicas[0] : [] // Dicas do jogador 1 (ordem 1, 2, 3)
            });
            
            console.log(`📤 Enviando evento 'inicio' para J2 (${j2Corrigido.id}): jogador=2, turno=${game.turno}`);
            io.to(j2Corrigido.id).emit('eventoJogo', {
              tipo: 'inicio',
              jogador: 2,
              adversario: j1Corrigido.name,
              palavra: estado2.palavra,
              palavraAdversario: estado1.palavra,
              palavraSecreta: game.words[1],
              turno: game.turno,
              categoria: game.categoria,
              meuSocketId: j2Corrigido.id,
              adversarioSocketId: j1Corrigido.id,
              vidas: game.vidas,
              poderes: j2Corrigido.poderes || [],
              dicas: game.dicas ? game.dicas[1] : [] // Dicas do jogador 2 (ordem 1, 2, 3)
            });
            return;
          }
          
          const estado1 = game.gameInstances[0].getEstado();
          const estado2 = game.gameInstances[1].getEstado();
          
          // Garante que o turno inicial seja sempre 1 (jogador 1 começa)
          game.turno = 1;
          game.turnoInicialRodada = 1; // Primeira rodada sempre começa com jogador 1
          game.jogoIniciado = true; // Marca que o jogo realmente começou
          
          console.log(`🎮 Iniciando jogo na sala ${roomId}`);
          console.log(`Jogador 1: ${j1.name} (${j1.id}, numero: ${j1.numero}), Jogador 2: ${j2.name} (${j2.id}, numero: ${j2.numero})`);
          console.log(`Turno inicial: ${game.turno}`);
          console.log(`✅ Palavras selecionadas para os jogadores`);

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
            palavra: estado1.palavra, // Palavra oculta do jogador 1
            palavraAdversario: estado2.palavra, // Palavra oculta do jogador 2
            palavraSecreta: game.words[0], // Palavra completa do jogador 1
            turno: game.turno, // Sempre 1 no início
            categoria: game.categoria,
            meuSocketId: j1.id, // Socket ID deste jogador para identificação única
            adversarioSocketId: j2.id, // Socket ID do adversário
            vidas: game.vidas,
            poderes: j1.poderes || [], // Poderes selecionados pelo jogador 1
            dicas: game.dicas ? game.dicas[0] : [] // Dicas do jogador 1 (ordem 1, 2, 3)
          };
          
          const eventoInicioJ2 = {
            tipo: 'inicio',
            jogador: 2,
            adversario: j1.name,
            palavra: estado2.palavra, // Palavra oculta do jogador 2
            palavraAdversario: estado1.palavra, // Palavra oculta do jogador 1
            palavraSecreta: game.words[1], // Palavra completa do jogador 2
            turno: game.turno, // Sempre 1 no início
            categoria: game.categoria,
            meuSocketId: j2.id, // Socket ID deste jogador para identificação única
            adversarioSocketId: j1.id, // Socket ID do adversário
            vidas: game.vidas,
            poderes: j2.poderes || [], // Poderes selecionados pelo jogador 2
            dicas: game.dicas ? game.dicas[1] : [] // Dicas do jogador 2 (ordem 1, 2, 3)
          };

          // Verifica se os sockets estão conectados ANTES de enviar
          const j1SocketVerificado = io.sockets.sockets.get(j1.id);
          const j2SocketVerificado = io.sockets.sockets.get(j2.id);
          
          if (j1SocketVerificado) {
            console.log(`📤 Enviando evento 'inicio' para J1 (${j1.id}):`, eventoInicioJ1);
            io.to(j1.id).emit('eventoJogo', eventoInicioJ1);
          } else {
            console.error(`❌ ERRO: Socket J1 (${j1.id}) não está conectado! Não foi possível enviar evento 'inicio'.`);
          }

          if (j2SocketVerificado) {
            console.log(`📤 Enviando evento 'inicio' para J2 (${j2.id}):`, eventoInicioJ2);
            io.to(j2.id).emit('eventoJogo', eventoInicioJ2);
          } else {
            console.error(`❌ ERRO: Socket J2 (${j2.id}) não está conectado! Não foi possível enviar evento 'inicio'.`);
          }
          
          // Verifica se os eventos foram enviados corretamente
          if (j1SocketVerificado && j2SocketVerificado) {
            console.log(`✅ Eventos 'inicio' enviados para ambos os jogadores`);
          } else {
            console.error(`❌ ERRO: Um ou ambos os sockets não estão conectados! J1: ${!!j1SocketVerificado}, J2: ${!!j2SocketVerificado}`);
          }
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

        // Verifica se o jogo ainda está em andamento (não terminou por chute de palavra)
        const gameInstanceJogador = game.gameInstances[numeroJogador - 1];
        if (gameInstanceJogador.status !== 'jogando') {
          console.log(`⚠️ Jogo não está mais em andamento para jogador ${numeroJogador}. Status: ${gameInstanceJogador.status}`);
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Esta rodada já terminou! Aguarde a próxima rodada.'
          });
          return;
        }

        // Verifica se o adversário tem palpite ativo
        const adversarioNum = numeroJogador === 1 ? 2 : 1;
        // gameInstanceJogador já foi declarado acima na verificação de status
        const gameInstanceAdversario = game.gameInstances[adversarioNum - 1];
        const palpiteAtivoAdversario = game.palpiteAtivo[adversarioNum] || false;
        let palpiteTransferido = false;
        let palpiteAcerto = false;
        let resultado = null;
        let alguemPerdeuVida = false;
        let jogadorQuePerdeuVida = null;
        let motivoPerdaVida = '';
        let palpiteBeneficiado = null;
        
        // Normaliza letra
        const letraProcessada = (msg.letra || '').toUpperCase();
        
        if (palpiteAtivoAdversario && gameInstanceAdversario && !gameInstanceAdversario.letrasChutadas.has(letraProcessada)) {
          console.log(`🎯 Palpite ativo do jogador ${adversarioNum} detectado! Letra '${letraProcessada}' será aplicada na palavra dele.`);
          palpiteTransferido = true;
          palpiteBeneficiado = adversarioNum;
          game.palpiteAtivo[adversarioNum] = false;
          
          const resultadoPalpite = gameInstanceAdversario.aplicarLetraPalpite(letraProcessada);
          palpiteAcerto = !!resultadoPalpite.acertou;
          resultado = palpiteAcerto ? 'palpite_acerto' : 'palpite_desviado';
          
          // Se o palpite completou a palavra do adversário, quem chutou perde vida
          if (resultadoPalpite.vitoria) {
            game.vidas[numeroJogador - 1]--;
            alguemPerdeuVida = true;
            jogadorQuePerdeuVida = numeroJogador;
            motivoPerdaVida = 'vitoria';
            console.log(`🎯 Palpite resultou em vitória! Jogador ${numeroJogador} perde uma vida. Vidas: J1=${game.vidas[0]}, J2=${game.vidas[1]}`);
          }
          
          // Turno retorna imediatamente para quem usou o palpite
          game.turno = adversarioNum;
        } else {
          // Processa a jogada normalmente
          resultado = gameInstanceJogador.chutarLetra(letraProcessada);
          console.log(`Jogada processada: letra=${letraProcessada}, resultado=${resultado}, turno atual=${game.turno}`);
          
          if (resultado === 'vitoria') {
            game.vidas[adversarioNum - 1]--;
            alguemPerdeuVida = true;
            jogadorQuePerdeuVida = adversarioNum;
            motivoPerdaVida = 'vitoria';
            console.log(`🎯 Jogador ${numeroJogador} completou sua palavra! Jogador ${adversarioNum} perde uma vida. Vidas restantes: J1=${game.vidas[0]}, J2=${game.vidas[1]}`);
          } else if (resultado === 'derrota') {
            game.vidas[numeroJogador - 1]--;
            alguemPerdeuVida = true;
            jogadorQuePerdeuVida = numeroJogador;
            motivoPerdaVida = 'erros';
            console.log(`❌ Jogador ${numeroJogador} errou 6 vezes! Ele perde uma vida. Vidas restantes: J1=${game.vidas[0]}, J2=${game.vidas[1]}`);
          }
        }
        
        const estadoJogador = gameInstanceJogador.getEstado();
        const estadoAdversario = gameInstanceAdversario.getEstado();
        
        // Se alguém perdeu vida, reseta AMBAS as palavras e começa nova rodada
        if (alguemPerdeuVida) {
          // Verifica se o jogo acabou
          if (game.vidas[0] <= 0 || game.vidas[1] <= 0) {
            const vencedor = game.vidas[0] > 0 ? 1 : 2;
            
            // Usa função centralizada para finalizar o jogo
            const eventoFim = await finalizarJogo(game, vencedor, 'normal');
            if (eventoFim) {
              io.to(roomId).emit('eventoJogo', eventoFim);
              setTimeout(() => {
                activeGames.delete(roomId);
              }, 5000);
            }
            return; // Não processa mais nada se o jogo acabou
          } else {
            // Reseta AMBAS as palavras para nova rodada (ainda há vidas)
            console.log(`🔄 Alguém perdeu vida! Resetando ambas as palavras para nova rodada...`);
            console.log(`📊 Vidas após perda: J1=${game.vidas[0]}, J2=${game.vidas[1]} - Continuando jogo`);
            console.log(`📋 Total de palavras já usadas: ${game.palavrasUsadas.length}`);
            
            try {
              // Busca primeira nova palavra excluindo todas as palavras já usadas no jogo
              const novaPalavraObj1 = await getRandomWord({ 
                categoria: game.categoria, 
                excluirPalavras: game.palavrasUsadas || [] 
              });
              const novaPalavra1 = (novaPalavraObj1?.palavra || 'FORCA').toUpperCase();
              const dificuldadeNova = novaPalavraObj1?.dificuldade || null; // Pega a dificuldade da primeira palavra
              
              // Busca segunda palavra com a MESMA dificuldade, excluindo a primeira E todas as palavras já usadas
              let novaPalavraObj2;
              let novaPalavra2;
              let tentativas = 0;
              const palavrasParaExcluir = [...(game.palavrasUsadas || []), novaPalavra1];
              
              // Tenta encontrar palavra com a mesma dificuldade
              if (dificuldadeNova) {
              do {
                  try {
                novaPalavraObj2 = await getRandomWord({ 
                  categoria: game.categoria, 
                      excluirPalavras: palavrasParaExcluir,
                      dificuldade: dificuldadeNova // Usa a mesma dificuldade da primeira palavra
                });
                    
                    if (novaPalavraObj2) {
                novaPalavra2 = (novaPalavraObj2?.palavra || 'FORCA').toUpperCase();
                      // Se encontrou palavra diferente, sai do loop
                      if (novaPalavra1 !== novaPalavra2) {
                        break;
                      }
                      // Se ainda assim for igual, adiciona à lista de exclusão e tenta novamente
                if (novaPalavra1 === novaPalavra2 && tentativas < 5) {
                  palavrasParaExcluir.push(novaPalavra2);
                }
                    }
                  } catch (error) {
                    // Se não encontrou palavra com essa dificuldade, tenta sem filtro
                    console.warn(`⚠️ Não foi possível encontrar palavra com dificuldade ${dificuldadeNova}. Tentando sem filtro...`);
                    novaPalavraObj2 = null;
                    break;
                  }
                  tentativas++;
              } while (novaPalavra1 === novaPalavra2 && tentativas < 5);
              }
              
              // Se não encontrou palavra com a mesma dificuldade, tenta sem filtro de dificuldade (fallback)
              if (!novaPalavraObj2) {
                if (dificuldadeNova) {
                  console.warn(`⚠️ Não foi possível encontrar palavra com dificuldade ${dificuldadeNova}. Buscando sem filtro de dificuldade...`);
                }
                novaPalavraObj2 = await getRandomWord({ 
                  categoria: game.categoria, 
                  excluirPalavras: palavrasParaExcluir 
                });
                novaPalavra2 = (novaPalavraObj2?.palavra || 'FORCA').toUpperCase();
              }
              
              // Adiciona as novas palavras à lista de palavras usadas
              if (!game.palavrasUsadas) {
                game.palavrasUsadas = [];
              }
              game.palavrasUsadas.push(novaPalavra1);
              if (novaPalavra1 !== novaPalavra2) {
                game.palavrasUsadas.push(novaPalavra2);
              }
              
              // Extrai as dicas das novas palavras (ordem 1, 2, 3)
              const novasDicasJogador1 = novaPalavraObj1?.dicas || [];
              const novasDicasJogador2 = novaPalavraObj2?.dicas || [];
              
              // Reseta ambas as instâncias
              game.words[0] = novaPalavra1;
              game.words[1] = novaPalavra2;
              game.gameInstances[0] = new Game(novaPalavra1, game.categoria);
              game.gameInstances[1] = new Game(novaPalavra2, game.categoria);
              game.dicas = [novasDicasJogador1, novasDicasJogador2]; // Atualiza dicas para nova rodada
              game.dicasPedidas = [0, 0]; // Reseta contador de dicas pedidas para nova rodada
              
              console.log(`✅ Novas palavras escolhidas para nova rodada`);
              console.log(`📋 Total de palavras usadas: ${game.palavrasUsadas.length}`);
              console.log(`💡 Dicas atualizadas: J1=${novasDicasJogador1.length} dicas, J2=${novasDicasJogador2.length} dicas`);
              
              // Alterna o turno: quem começou a rodada anterior, o outro começa a próxima
              // Se a rodada anterior começou com o jogador 1, a próxima começa com o jogador 2
              const turnoAnterior = game.turnoInicialRodada || 1;
              game.turno = turnoAnterior === 1 ? 2 : 1;
              game.turnoInicialRodada = game.turno; // Salva o turno inicial da nova rodada
              
              console.log(`✅ Nova rodada iniciada! Turno: Jogador ${game.turno} (rodada anterior começou com J${turnoAnterior})`);
            } catch (error) {
              console.error('Erro ao buscar novas palavras:', error);
              // No fallback, tenta usar palavras diferentes das já usadas
              const palavrasFallback = ['FORCA', 'JOGO', 'TESTE', 'LIVRO', 'CASA', 'GATO', 'CARRO', 'MESA'];
              let palavraFallback1 = 'FORCA';
              let palavraFallback2 = 'JOGO';
              
              // Tenta escolher palavras que não foram usadas
              const palavrasDisponiveis = palavrasFallback.filter(p => 
                !game.palavrasUsadas || !game.palavrasUsadas.includes(p)
              );
              
              if (palavrasDisponiveis.length >= 2) {
                palavraFallback1 = palavrasDisponiveis[0];
                palavraFallback2 = palavrasDisponiveis[1];
              } else if (palavrasDisponiveis.length >= 1) {
                palavraFallback1 = palavrasDisponiveis[0];
                palavraFallback2 = palavrasFallback.find(p => p !== palavraFallback1) || 'JOGO';
              }
              
              game.words[0] = palavraFallback1;
              game.words[1] = palavraFallback2;
              game.gameInstances[0] = new Game(palavraFallback1, game.categoria);
              game.gameInstances[1] = new Game(palavraFallback2, game.categoria);
              
              // No fallback, não há dicas (palavras padrão)
              game.dicas = [[], []];
              game.dicasPedidas = [0, 0]; // Reseta contador de dicas pedidas
              
              // Adiciona ao array de palavras usadas
              if (!game.palavrasUsadas) {
                game.palavrasUsadas = [];
              }
              if (!game.palavrasUsadas.includes(palavraFallback1)) {
                game.palavrasUsadas.push(palavraFallback1);
              }
              if (palavraFallback1 !== palavraFallback2 && !game.palavrasUsadas.includes(palavraFallback2)) {
                game.palavrasUsadas.push(palavraFallback2);
              }
              // Alterna o turno também no catch
              const turnoAnterior = game.turnoInicialRodada || 1;
              game.turno = turnoAnterior === 1 ? 2 : 1;
              game.turnoInicialRodada = game.turno;
              
              console.log(`⚠️ Usando palavras fallback`);
            }
          }
        }
        
        // Controle de turno
        if (!palpiteTransferido && resultado !== 'repetida' && !alguemPerdeuVida && gameInstanceJogador.status === 'jogando') {
          // Se a jogada foi válida (não repetida) e o jogo continua, troca o turno
          // Mas se alguém perdeu vida, o turno já foi resetado para 1
          game.turno = game.turno === 1 ? 2 : 1;
          console.log(`Turno trocado para: ${game.turno}`);
        }

        // Envia o resultado para todos na sala
        // Cada jogador recebe sua própria palavra e a do adversário
        const estado1Final = game.gameInstances[0].getEstado();
        const estado2Final = game.gameInstances[1].getEstado();
        
        const eventoJogada = {
          tipo: 'jogada',
          letra: msg.letra,
          resultado: resultado, // 'acerto', 'erro', 'vitoria', 'derrota', 'repetida'
          palavraJogador1: estado1Final.palavra,
          palavraJogador2: estado2Final.palavra,
          errosJogador1: estado1Final.erros,
          errosJogador2: estado2Final.erros,
          letrasChutadasJogador1: estado1Final.letrasChutadas,
          letrasChutadasJogador2: estado2Final.letrasChutadas,
          turno: game.turno,
          statusJogador1: estado1Final.status,
          statusJogador2: estado2Final.status,
          vidas: game.vidas,
          alguemPerdeuVida: alguemPerdeuVida,
          jogadorQuePerdeuVida: jogadorQuePerdeuVida,
          motivoPerdaVida: motivoPerdaVida,
          jogadorQueJogou: numeroJogador,
          novaRodada: alguemPerdeuVida && game.vidas[0] > 0 && game.vidas[1] > 0,
          palpiteTransferido: palpiteTransferido,
          palpiteBeneficiado: palpiteBeneficiado,
          palpiteAcerto: palpiteTransferido ? palpiteAcerto : null,
          palpiteLetra: palpiteTransferido ? letraProcessada : null
        };
        
        // Se começou nova rodada, adiciona informações sobre as novas palavras e dicas
        if (eventoJogada.novaRodada) {
          if (game.words && game.words.length === 2) {
            eventoJogada.novaPalavraJogador1 = game.words[0];
            eventoJogada.novaPalavraJogador2 = game.words[1];
            // Envia dicas para ambos os jogadores se começou nova rodada
            eventoJogada.dicasJogador1 = game.dicas && game.dicas[0] ? game.dicas[0] : [];
            eventoJogada.dicasJogador2 = game.dicas && game.dicas[1] ? game.dicas[1] : [];
            console.log(`📤 Enviando nova rodada`);
            console.log(`💡 Enviando dicas: J1=${eventoJogada.dicasJogador1.length} dicas, J2=${eventoJogada.dicasJogador2.length} dicas`);
          } else {
            console.error(`❌ ERRO: novaRodada=true mas game.words não está disponível ou inválido!`);
            console.error(`   game.words:`, game.words);
            console.error(`   game.words.length:`, game.words?.length);
            // Tenta usar as palavras das instâncias como fallback
            if (game.gameInstances && game.gameInstances.length === 2) {
              eventoJogada.novaPalavraJogador1 = game.gameInstances[0].palavraSecreta || '';
              eventoJogada.novaPalavraJogador2 = game.gameInstances[1].palavraSecreta || '';
              eventoJogada.dicasJogador1 = [];
              eventoJogada.dicasJogador2 = [];
              console.log(`⚠️ Usando palavras das instâncias como fallback`);
            }
          }
        }
        
        console.log(`📤 Enviando evento jogada: novaRodada=${eventoJogada.novaRodada}, alguemPerdeuVida=${eventoJogada.alguemPerdeuVida}, vidas=${JSON.stringify(eventoJogada.vidas)}`);
        io.to(roomId).emit('eventoJogo', eventoJogada);

      }

      if (msg.tipo === 'definirAposta') {
        // Handler para atualizar aposta antes de clicar em "pronto"
        const jogadorAtual = game.players.find(p => p.id === socket.id);
        if (!jogadorAtual) return;
        
        const valorAposta = parseInt(msg.valor) || 0;
        
        // Valida aposta
        if (valorAposta >= 0 && jogadorAtual.playerId) {
          try {
            const player = await models.Player.findByPk(jogadorAtual.playerId);
            if (player) {
              const moedasAtuais = player.moedas || 0;
              if (valorAposta > moedasAtuais) {
                socket.emit('eventoJogo', {
                  tipo: 'erro',
                  mensagem: `Você não tem moedas suficientes! Saldo: ${moedasAtuais}`
                });
                return;
              }
              game.apostas[jogadorAtual.numero] = valorAposta;
              console.log(`💰 Aposta do jogador ${jogadorAtual.numero} atualizada: ${valorAposta} moedas`);
              
              // Emite evento de aposta atualizada para todos na sala
              io.to(roomId).emit('eventoJogo', {
                tipo: 'apostaAtualizada',
                jogador: jogadorAtual.name,
                valor: valorAposta
              });
            }
          } catch (error) {
            console.error(`❌ Erro ao validar aposta:`, error);
            socket.emit('eventoJogo', {
              tipo: 'erro',
              mensagem: 'Erro ao validar aposta'
            });
          }
        }
        return;
      }
      
      if (msg.tipo === 'pedirDica') {
        // Verifica se o jogador existe
        const jogadorAtual = game.players.find(p => p.id === socket.id);
        if (!jogadorAtual) {
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Jogador não encontrado na sala!'
          });
          return;
        }
        
        const numeroJogador = jogadorAtual.numero;
        
        // Verifica se é o turno do jogador
        if (numeroJogador !== game.turno) {
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Você só pode pedir dica no seu turno!'
          });
          return;
        }
        
        // Verifica se há dicas disponíveis para este jogador
        if (!game.dicas || !game.dicas[numeroJogador - 1] || game.dicas[numeroJogador - 1].length === 0) {
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Não há dicas disponíveis!'
          });
          return;
        }
        
        // Determina qual dica será exibida (baseado em quantas já foram pedidas)
        // Por enquanto, vamos usar um contador simples: primeira dica = ordem 1, segunda = ordem 2, terceira = ordem 3
        // Mas precisamos rastrear quantas dicas cada jogador já pediu
        if (!game.dicasPedidas) {
          game.dicasPedidas = [0, 0]; // [contador J1, contador J2]
        }
        
        const indiceJogador = numeroJogador - 1;
        const dicasPedidasJogador = game.dicasPedidas[indiceJogador];
        
        // Verifica se já pediu todas as 3 dicas
        if (dicasPedidasJogador >= 3) {
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Você já pediu todas as dicas disponíveis!'
          });
          return;
        }
        
        // Verifica se a dica está bloqueada para este jogador
        const dicaEstaBloqueada = game.dicaBloqueada[numeroJogador] === true;
        
        // Incrementa o contador de dicas pedidas para este jogador
        game.dicasPedidas[indiceJogador]++;
        const ordemDica = game.dicasPedidas[indiceJogador]; // 1, 2 ou 3
        
        // Encontra a dica com a ordem correspondente
        const dicasJogador = game.dicas[indiceJogador];
        const dica = dicasJogador.find(d => d.ordem === ordemDica);
        
        if (!dica) {
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Dica não encontrada!'
          });
          // Reverte o contador
          game.dicasPedidas[indiceJogador]--;
          return;
        }
        
        // Passa o turno
        game.turno = game.turno === 1 ? 2 : 1;
        console.log(`💡 Jogador ${numeroJogador} pediu dica ${ordemDica}. Turno passou para: ${game.turno}`);
        
        // Se a dica está bloqueada, não mostra o texto (mas ainda passa o turno e consome a dica)
        let textoDica = '';
        if (dicaEstaBloqueada) {
          // Dica foi bloqueada pelo poder "ocultar_dica"
          // Remove o bloqueio (foi consumido)
          game.dicaBloqueada[numeroJogador] = false;
          console.log(`🚫 Dica ${ordemDica} do jogador ${numeroJogador} foi bloqueada pelo poder "ocultar_dica"`);
        } else {
          // Dica não está bloqueada, mostra normalmente
          // Nota: as dicas vêm do wordService com a propriedade 'texto', não 'texto_dica'
          textoDica = dica.texto || dica.texto_dica;
          console.log(`💡 Enviando dica ${ordemDica} para jogador ${numeroJogador}`);
        }
        
        // Emite evento para ambos os jogadores com a dica (texto vazio se bloqueada)
        io.to(roomId).emit('eventoJogo', {
          tipo: 'dicaPedida',
          jogadorQuePediu: numeroJogador,
          ordemDica: ordemDica,
          textoDica: textoDica, // Vazio se bloqueada
          bloqueada: dicaEstaBloqueada, // Indica se a dica foi bloqueada
          turno: game.turno
        });
        
        return;
      }
      
      if (msg.tipo === 'chutarPalavra') {
        try {
          console.log(`🎯 Recebido evento chutarPalavra:`, msg);
          
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
          
          const numeroJogador = jogadorAtual.numero;
          
          console.log(`🎯 Verificando turno para chute de palavra: jogador=${numeroJogador}, turno atual=${game.turno}`);
          
          if (numeroJogador !== game.turno) {
            console.log(`❌ Não é o turno do jogador ${numeroJogador}. Turno atual: ${game.turno}`);
            socket.emit('eventoJogo', {
              tipo: 'erro',
              mensagem: 'Não é seu turno!'
            });
            return;
          }
          
          const palavraChutada = (msg.palavra || '').trim();
          if (!palavraChutada) {
            console.log(`❌ Palavra vazia recebida`);
            socket.emit('eventoJogo', {
              tipo: 'erro',
              mensagem: 'Palavra não pode estar vazia!'
            });
            return;
          }
          
          console.log(`✅ É o turno do jogador ${numeroJogador}. Processando chute de palavra`);
          
          const gameInstanceJogador = game.gameInstances[numeroJogador - 1];
          const gameInstanceAdversario = game.gameInstances[(numeroJogador === 1 ? 2 : 1) - 1];
          const adversarioNum = numeroJogador === 1 ? 2 : 1;
          
          console.log(`📋 Estado antes do chute:`, {
            palavraSecreta: gameInstanceJogador.palavraSecreta,
            status: gameInstanceJogador.status,
            palavraChutada: palavraChutada
          });
          
          let alguemPerdeuVida = false;
          let jogadorQuePerdeuVida = null;
          let motivoPerdaVida = '';
          
          // Chuta a palavra completa
          const resultado = gameInstanceJogador.chutarPalavraCompleta(palavraChutada);
          console.log(`📊 Chute de palavra processado: resultado=${resultado}, status=${gameInstanceJogador.status}`);
          
          if (resultado === 'vitoria') {
            // Acertou! Adversário perde vida
            game.vidas[adversarioNum - 1]--;
            alguemPerdeuVida = true;
            jogadorQuePerdeuVida = adversarioNum;
            motivoPerdaVida = 'vitoria';
            console.log(`🎯 Jogador ${numeroJogador} acertou a palavra! Jogador ${adversarioNum} perde uma vida. Vidas restantes: J1=${game.vidas[0]}, J2=${game.vidas[1]}`);
          } else if (resultado === 'derrota') {
            // Errou! Jogador perde vida
            game.vidas[numeroJogador - 1]--;
            alguemPerdeuVida = true;
            jogadorQuePerdeuVida = numeroJogador;
            motivoPerdaVida = 'erro_palavra';
            console.log(`❌ Jogador ${numeroJogador} errou a palavra! Ele perde uma vida. Vidas restantes: J1=${game.vidas[0]}, J2=${game.vidas[1]}`);
          }
          
          const estadoJogador = gameInstanceJogador.getEstado();
          const estadoAdversario = gameInstanceAdversario.getEstado();
          
          // Se alguém perdeu vida, reseta AMBAS as palavras e começa nova rodada
          if (alguemPerdeuVida) {
            // Verifica se o jogo acabou
            console.log(`📊 Verificando fim de jogo após chute de palavra: J1=${game.vidas[0]}, J2=${game.vidas[1]}`);
            if (game.vidas[0] <= 0 || game.vidas[1] <= 0) {
              const vencedor = game.vidas[0] > 0 ? 1 : 2;
              
              // Usa função centralizada para finalizar o jogo
              const eventoFim = await finalizarJogo(game, vencedor, 'normal');
              if (eventoFim) {
                io.to(roomId).emit('eventoJogo', eventoFim);
                setTimeout(() => {
                  activeGames.delete(roomId);
                }, 5000);
              }
              return;
            }
            
            // Se chegou aqui, alguém perdeu vida mas o jogo continua - reseta AMBAS as palavras para nova rodada
            console.log(`🔄 Alguém perdeu vida! Resetando ambas as palavras para nova rodada...`);
            console.log(`📊 Vidas após perda: J1=${game.vidas[0]}, J2=${game.vidas[1]} - Continuando jogo`);
            console.log(`📋 Total de palavras já usadas: ${game.palavrasUsadas.length}`);
            
            try {
              // Busca primeira nova palavra excluindo todas as palavras já usadas no jogo
              const novaPalavraObj1 = await getRandomWord({ 
                categoria: game.categoria, 
                excluirPalavras: game.palavrasUsadas || [] 
              });
              const novaPalavra1 = (novaPalavraObj1?.palavra || 'FORCA').toUpperCase();
              const dificuldadeNova = novaPalavraObj1?.dificuldade || null;
              
              // Busca segunda palavra com a MESMA dificuldade, excluindo a primeira E todas as palavras já usadas
              let novaPalavraObj2;
              let novaPalavra2;
              let tentativas = 0;
              const palavrasParaExcluir = [...(game.palavrasUsadas || []), novaPalavra1];
              
              // Tenta encontrar palavra com a mesma dificuldade
              if (dificuldadeNova) {
                do {
                  try {
                    novaPalavraObj2 = await getRandomWord({ 
                      categoria: game.categoria, 
                      excluirPalavras: palavrasParaExcluir,
                      dificuldade: dificuldadeNova
                    });
                    
                    if (novaPalavraObj2) {
                      novaPalavra2 = (novaPalavraObj2?.palavra || 'FORCA').toUpperCase();
                      if (novaPalavra1 !== novaPalavra2) {
                        break;
                      }
                      if (novaPalavra1 === novaPalavra2 && tentativas < 5) {
                        palavrasParaExcluir.push(novaPalavra2);
                      }
                    }
                  } catch (error) {
                    console.warn(`⚠️ Não foi possível encontrar palavra com dificuldade ${dificuldadeNova}. Tentando sem filtro...`);
                    novaPalavraObj2 = null;
                    break;
                  }
                  tentativas++;
                } while (novaPalavra1 === novaPalavra2 && tentativas < 5);
              }
              
              // Se não encontrou palavra com a mesma dificuldade, tenta sem filtro de dificuldade (fallback)
              if (!novaPalavraObj2) {
                if (dificuldadeNova) {
                  console.warn(`⚠️ Não foi possível encontrar palavra com dificuldade ${dificuldadeNova}. Buscando sem filtro de dificuldade...`);
                }
                novaPalavraObj2 = await getRandomWord({ 
                  categoria: game.categoria, 
                  excluirPalavras: palavrasParaExcluir 
                });
                novaPalavra2 = (novaPalavraObj2?.palavra || 'FORCA').toUpperCase();
              }
              
              // Adiciona as novas palavras à lista de palavras usadas
              if (!game.palavrasUsadas) {
                game.palavrasUsadas = [];
              }
              game.palavrasUsadas.push(novaPalavra1);
              if (novaPalavra1 !== novaPalavra2) {
                game.palavrasUsadas.push(novaPalavra2);
              }
              
              // Reseta ambas as instâncias
              game.words[0] = novaPalavra1;
              game.words[1] = novaPalavra2;
              game.gameInstances[0] = new Game(novaPalavra1, game.categoria);
              game.gameInstances[1] = new Game(novaPalavra2, game.categoria);
              
              // Atualiza as dicas das novas palavras
              const dicasJogador1 = novaPalavraObj1?.dicas?.filter(d => d.ordem >= 1 && d.ordem <= 3) || [];
              const dicasJogador2 = novaPalavraObj2?.dicas?.filter(d => d.ordem >= 1 && d.ordem <= 3) || [];
              game.dicas = [dicasJogador1, dicasJogador2];
              game.dicasPedidas = [0, 0]; // Reseta contador de dicas pedidas para nova rodada
              
              console.log(`✅ Novas palavras escolhidas para nova rodada`);
              console.log(`💡 Novas dicas: J1=${dicasJogador1.length} dicas, J2=${dicasJogador2.length} dicas`);
              
              // Alterna o turno: quem começou a rodada anterior, o outro começa a próxima
              const turnoAnterior = game.turnoInicialRodada || 1;
              game.turno = turnoAnterior === 1 ? 2 : 1;
              game.turnoInicialRodada = game.turno;
              
              console.log(`✅ Nova rodada iniciada após chute de palavra! Turno: Jogador ${game.turno}`);
            } catch (error) {
              console.error('❌ Erro ao buscar novas palavras para nova rodada:', error);
              console.error('Stack trace:', error.stack);
              // Fallback - usa palavras padrão para não quebrar o jogo
              const palavrasFallback = ['FORCA', 'JOGO', 'TESTE', 'LIVRO', 'CASA', 'GATO', 'CARRO', 'MESA'];
              let palavraFallback1 = 'FORCA';
              let palavraFallback2 = 'JOGO';
              
              const palavrasDisponiveis = palavrasFallback.filter(p => 
                !game.palavrasUsadas || !game.palavrasUsadas.includes(p)
              );
              
              if (palavrasDisponiveis.length >= 2) {
                palavraFallback1 = palavrasDisponiveis[0];
                palavraFallback2 = palavrasDisponiveis[1];
              } else if (palavrasDisponiveis.length >= 1) {
                palavraFallback1 = palavrasDisponiveis[0];
                palavraFallback2 = palavrasFallback.find(p => p !== palavraFallback1) || 'JOGO';
              }
              
              game.words[0] = palavraFallback1;
              game.words[1] = palavraFallback2;
              game.gameInstances[0] = new Game(palavraFallback1, game.categoria);
              game.gameInstances[1] = new Game(palavraFallback2, game.categoria);
              
              // Garante que ambas as instâncias estão com status 'jogando'
              if (game.gameInstances[0].status !== 'jogando') {
                game.gameInstances[0].status = 'jogando';
              }
              if (game.gameInstances[1].status !== 'jogando') {
                game.gameInstances[1].status = 'jogando';
              }
              
              if (!game.palavrasUsadas) {
                game.palavrasUsadas = [];
              }
              if (!game.palavrasUsadas.includes(palavraFallback1)) {
                game.palavrasUsadas.push(palavraFallback1);
              }
              if (palavraFallback1 !== palavraFallback2 && !game.palavrasUsadas.includes(palavraFallback2)) {
                game.palavrasUsadas.push(palavraFallback2);
              }
              const turnoAnterior = game.turnoInicialRodada || 1;
              game.turno = turnoAnterior === 1 ? 2 : 1;
              game.turnoInicialRodada = game.turno;
            }
          }
          
          // Controle de turno - se não perdeu vida, troca o turno normalmente
          if (!alguemPerdeuVida && gameInstanceJogador.status === 'jogando') {
            game.turno = game.turno === 1 ? 2 : 1;
            console.log(`Turno trocado para: ${game.turno}`);
          }
          
          // Envia o resultado para todos na sala
          const estado1Final = game.gameInstances[0].getEstado();
          const estado2Final = game.gameInstances[1].getEstado();
          
          // Se houve nova rodada, envia também as palavras secretas para resetar corretamente
          const eventoChutePalavra = {
            tipo: 'chutePalavra',
            palavraChutada: palavraChutada,
            resultado: resultado, // 'vitoria' ou 'derrota'
            palavraJogador1: estado1Final.palavra,
            palavraJogador2: estado2Final.palavra,
            errosJogador1: estado1Final.erros,
            errosJogador2: estado2Final.erros,
            letrasChutadasJogador1: estado1Final.letrasChutadas,
            letrasChutadasJogador2: estado2Final.letrasChutadas,
            turno: game.turno,
            statusJogador1: estado1Final.status,
            statusJogador2: estado2Final.status,
            vidas: game.vidas,
            alguemPerdeuVida: alguemPerdeuVida,
            jogadorQuePerdeuVida: jogadorQuePerdeuVida,
            motivoPerdaVida: motivoPerdaVida,
            jogadorQueJogou: numeroJogador,
            novaRodada: alguemPerdeuVida && game.vidas[0] > 0 && game.vidas[1] > 0
          };
          
          // Se é nova rodada, adiciona informações sobre as novas palavras e dicas
          if (eventoChutePalavra.novaRodada) {
            eventoChutePalavra.novaPalavraJogador1 = game.words[0];
            eventoChutePalavra.novaPalavraJogador2 = game.words[1];
            // Usa as dicas já armazenadas no game
            eventoChutePalavra.dicasJogador1 = game.dicas[0] || [];
            eventoChutePalavra.dicasJogador2 = game.dicas[1] || [];
            console.log(`📤 Enviando nova rodada`);
            console.log(`💡 Enviando dicas: J1=${eventoChutePalavra.dicasJogador1.length} dicas, J2=${eventoChutePalavra.dicasJogador2.length} dicas`);
          }
          
          io.to(roomId).emit('eventoJogo', eventoChutePalavra);
        } catch (error) {
          console.error(`❌ Erro ao processar chute de palavra:`, error);
          console.error(`Stack trace:`, error.stack);
          // Envia erro para o jogador sem desconectar
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Erro ao processar chute de palavra. Tente novamente.'
          });
          // Não desconecta o socket, apenas envia erro
        }
      }

      if (msg.tipo === 'tempoEsgotado') {
        // Verifica se é o turno do jogador que enviou o evento
        const jogadorAtual = game.players.find(p => p.id === socket.id);
        if (!jogadorAtual) {
          console.log(`❌ Jogador não encontrado: ${socket.id}`);
          return;
        }

        const numeroJogador = jogadorAtual.numero;
        
        // Só passa o turno se for realmente o turno deste jogador e o jogo está ativo
        const gameInstanceJogador = game.gameInstances[numeroJogador - 1];
        if (numeroJogador === game.turno && gameInstanceJogador.status === 'jogando') {
          console.log(`⏱️ Tempo esgotado para jogador ${numeroJogador}. Passando turno...`);
          
          // Troca o turno
          game.turno = game.turno === 1 ? 2 : 1;
          
          const estado1 = game.gameInstances[0].getEstado();
          const estado2 = game.gameInstances[1].getEstado();
          
          // Notifica todos na sala sobre a mudança de turno
          const estado1Atualizado = game.gameInstances[0].getEstado();
          const estado2Atualizado = game.gameInstances[1].getEstado();
          
          io.to(roomId).emit('eventoJogo', {
            tipo: 'turnoTrocado',
            turno: game.turno,
            palavraJogador1: estado1Atualizado.palavra,
            palavraJogador2: estado2Atualizado.palavra,
            errosJogador1: estado1Atualizado.erros,
            errosJogador2: estado2Atualizado.erros,
            letrasChutadasJogador1: estado1Atualizado.letrasChutadas,
            letrasChutadasJogador2: estado2Atualizado.letrasChutadas,
            statusJogador1: estado1Atualizado.status,
            statusJogador2: estado2Atualizado.status,
            vidas: game.vidas
          });
          
          console.log(`✅ Turno trocado para: ${game.turno}`);
        } else {
          console.log(`⚠️ Tentativa de passar turno inválida: jogador=${numeroJogador}, turno atual=${game.turno}`);
        }
      }

      if (msg.tipo === 'usarPoder') {
        console.log(`🎯 Evento 'usarPoder' recebido: poderId=${msg.poderId}, jogador=${msg.jogador}, socket.id=${socket.id}`);
        
        const jogadorAtual = game.players.find(p => p.id === socket.id);
        
        if (!jogadorAtual) {
          console.error(`❌ Jogador não encontrado: ${socket.id}`);
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Jogador não encontrado na sala!'
          });
          return;
        }
        
        const numeroJogador = jogadorAtual.numero;
        const poderId = msg.poderId;
        
        // Verifica se é o turno do jogador (poderes só podem ser usados no próprio turno)
        if (numeroJogador !== game.turno) {
          console.log(`❌ Não é o turno do jogador ${numeroJogador}. Turno atual: ${game.turno}`);
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Você só pode usar poderes no seu turno!'
          });
          return;
        }
        
        // Verifica se o jogador tem esse poder disponível
        const poderesJogador = jogadorAtual.poderes || [];
        if (!poderesJogador.includes(poderId)) {
          console.log(`❌ Jogador ${numeroJogador} não tem o poder ${poderId} disponível`);
          socket.emit('eventoJogo', {
            tipo: 'erro',
            mensagem: 'Este poder não está disponível!'
          });
          return;
        }
        
        console.log(`✅ Processando poder ${poderId} do jogador ${numeroJogador}`);
        
        // Processa o poder baseado no tipo
        let resultadoPoder = null;
        let vidasAtualizadas = [...game.vidas]; // Cópia das vidas atuais
        
        switch (poderId) {
          case 'vida_extra': {
            // Adiciona uma vida ao jogador (pode ultrapassar 3)
            const vidaAtual = game.vidas[numeroJogador - 1];
            vidasAtualizadas[numeroJogador - 1] = Math.min(vidaAtual + 1, 4); // Máximo 4 vidas
            game.vidas[numeroJogador - 1] = vidasAtualizadas[numeroJogador - 1];
            resultadoPoder = {
              tipo: 'vidaExtra',
              jogador: numeroJogador,
              novasVidas: vidasAtualizadas,
              sucesso: true
            };
            console.log(`💚 Vida extra adicionada! Jogador ${numeroJogador} agora tem ${vidasAtualizadas[numeroJogador - 1]} vidas`);
            break;
          }
            
          case 'tirar_vida': {
            // Adiciona um erro na forca do adversário (não remove vida diretamente)
            const adversarioNum = numeroJogador === 1 ? 2 : 1;
            const gameInstanceAdversario = game.gameInstances[adversarioNum - 1];
            
            if (gameInstanceAdversario && gameInstanceAdversario.status === 'jogando') {
              // Adiciona um erro (como se o adversário tivesse errado)
              gameInstanceAdversario.erros++;
              
              // Verifica se o adversário perdeu (6 erros = perde uma vida)
              if (gameInstanceAdversario.erros >= 6) {
                game.vidas[adversarioNum - 1]--;
                vidasAtualizadas[adversarioNum - 1] = game.vidas[adversarioNum - 1];
                gameInstanceAdversario.status = 'derrota';
                
                // Verifica se o jogo acabou
                if (vidasAtualizadas[adversarioNum - 1] <= 0) {
                  const vencedor = numeroJogador;
                  
                  // Atualiza vidas do game antes de finalizar
                  game.vidas = vidasAtualizadas;
                  
                  // Usa função centralizada para finalizar o jogo
                  const eventoFim = await finalizarJogo(game, vencedor, 'normal');
                  if (eventoFim) {
                    io.to(roomId).emit('eventoJogo', eventoFim);
                    setTimeout(() => {
                      activeGames.delete(roomId);
                    }, 5000);
                  }
                  
                  jogadorAtual.poderes = jogadorAtual.poderes.filter(p => p !== poderId);
                  return;
                } else {
                  // Adversário perdeu uma vida mas ainda tem vidas - reseta para nova rodada
                  console.log(`🔄 Adversário perdeu uma vida! Resetando ambas as palavras para nova rodada...`);
                  console.log(`📊 Vidas após perda: J1=${vidasAtualizadas[0]}, J2=${vidasAtualizadas[1]} - Continuando jogo`);
                  
                  try {
                    // Busca primeira nova palavra excluindo todas as palavras já usadas no jogo
                    const novaPalavraObj1 = await getRandomWord({ 
                      categoria: game.categoria, 
                      excluirPalavras: game.palavrasUsadas || [] 
                    });
                    const novaPalavra1 = (novaPalavraObj1?.palavra || 'FORCA').toUpperCase();
                    const dificuldadeNova = novaPalavraObj1?.dificuldade || null;
                    
                    // Busca segunda palavra com a MESMA dificuldade
                    let novaPalavraObj2;
                    let novaPalavra2;
                    let tentativas = 0;
                    const palavrasParaExcluir = [...(game.palavrasUsadas || []), novaPalavra1];
                    
                    if (dificuldadeNova) {
                      do {
                        try {
                          novaPalavraObj2 = await getRandomWord({ 
                            categoria: game.categoria, 
                            excluirPalavras: palavrasParaExcluir,
                            dificuldade: dificuldadeNova
                          });
                          
                          if (novaPalavraObj2) {
                            novaPalavra2 = (novaPalavraObj2?.palavra || 'FORCA').toUpperCase();
                            if (novaPalavra1 !== novaPalavra2) {
                              break;
                            }
                            if (novaPalavra1 === novaPalavra2 && tentativas < 5) {
                              palavrasParaExcluir.push(novaPalavra2);
                            }
                          }
                        } catch (error) {
                          console.warn(`⚠️ Não foi possível encontrar palavra com dificuldade ${dificuldadeNova}. Tentando sem filtro...`);
                          novaPalavraObj2 = null;
                          break;
                        }
                        tentativas++;
                      } while (novaPalavra1 === novaPalavra2 && tentativas < 5);
                    }
                    
                    // Se não encontrou palavra com a mesma dificuldade, tenta sem filtro
                    if (!novaPalavraObj2) {
                      if (dificuldadeNova) {
                        console.warn(`⚠️ Não foi possível encontrar palavra com dificuldade ${dificuldadeNova}. Buscando sem filtro de dificuldade...`);
                      }
                      novaPalavraObj2 = await getRandomWord({ 
                        categoria: game.categoria, 
                        excluirPalavras: palavrasParaExcluir 
                      });
                      novaPalavra2 = (novaPalavraObj2?.palavra || 'FORCA').toUpperCase();
                    }
                    
                    // Adiciona as novas palavras à lista de palavras usadas
                    if (!game.palavrasUsadas) {
                      game.palavrasUsadas = [];
                    }
                    game.palavrasUsadas.push(novaPalavra1);
                    if (novaPalavra1 !== novaPalavra2) {
                      game.palavrasUsadas.push(novaPalavra2);
                    }
                    
                    // Reseta ambas as instâncias
                    game.words[0] = novaPalavra1;
                    game.words[1] = novaPalavra2;
                    game.gameInstances[0] = new Game(novaPalavra1, game.categoria);
                    game.gameInstances[1] = new Game(novaPalavra2, game.categoria);
                    
                    // Atualiza as dicas das novas palavras
                    const dicasJogador1 = novaPalavraObj1?.dicas?.filter(d => d.ordem >= 1 && d.ordem <= 3) || [];
                    const dicasJogador2 = novaPalavraObj2?.dicas?.filter(d => d.ordem >= 1 && d.ordem <= 3) || [];
                    game.dicas = [dicasJogador1, dicasJogador2];
                    
                    // Alterna o turno: quem começou a rodada anterior, o outro começa a próxima
                    const turnoAnterior = game.turnoInicialRodada || 1;
                    game.turno = turnoAnterior === 1 ? 2 : 1;
                    game.turnoInicialRodada = game.turno;
                    
                    console.log(`✅ Nova rodada iniciada! Turno: Jogador ${game.turno}`);
                    
                    // Atualiza o resultado do poder para incluir informações da nova rodada
                    resultadoPoder.novaRodada = true;
                    resultadoPoder.novaPalavraJogador1 = novaPalavra1;
                    resultadoPoder.novaPalavraJogador2 = novaPalavra2;
                    resultadoPoder.dicasJogador1 = dicasJogador1;
                    resultadoPoder.dicasJogador2 = dicasJogador2;
                  } catch (error) {
                    console.error('❌ Erro ao buscar novas palavras para nova rodada:', error);
                    console.error('Stack trace:', error.stack);
                  }
                }
              }
              
              const estadoAdversario = gameInstanceAdversario.getEstado();
              resultadoPoder = {
                tipo: 'tirarVida',
                jogador: numeroJogador,
                alvo: adversarioNum,
                errosAdversario: estadoAdversario.erros,
                novasVidas: vidasAtualizadas,
                sucesso: true,
                adversarioPerdeuVida: gameInstanceAdversario.erros >= 6
              };
              console.log(`⚔️ Erro adicionado à forca do adversário! Jogador ${adversarioNum} agora tem ${estadoAdversario.erros} erros${gameInstanceAdversario.erros >= 6 ? ' (perdeu uma vida!)' : ''}`);
            } else {
              resultadoPoder = {
                tipo: 'tirarVida',
                jogador: numeroJogador,
                alvo: adversarioNum,
                sucesso: false,
                mensagem: 'Adversário não está em jogo'
              };
            }
            break;
          }
            
          case 'liberar_letra': {
            // Revela uma letra da palavra do jogador (todas as ocorrências)
            const gameInstance = game.gameInstances[numeroJogador - 1];
            if (gameInstance && gameInstance.status === 'jogando') {
              // Encontra letras que estão na palavra mas ainda não foram reveladas
              const palavraSecreta = game.words[numeroJogador - 1];
              
              // Conta frequência de cada letra não revelada na palavra
              const contagemLetras = {};
              for (const letra of palavraSecreta) {
                if (letra !== ' ' && !gameInstance.letrasChutadas.has(letra)) {
                  contagemLetras[letra] = (contagemLetras[letra] || 0) + 1;
                }
              }
              
              // Encontra a letra mais frequente que ainda não foi revelada
              let letraEscolhida = null;
              let maxFrequencia = 0;
              
              for (const letra in contagemLetras) {
                if (contagemLetras[letra] > maxFrequencia) {
                  maxFrequencia = contagemLetras[letra];
                  letraEscolhida = letra;
                }
              }
              
              // Se não encontrou letra mais frequente, escolhe qualquer uma disponível
              if (!letraEscolhida && Object.keys(contagemLetras).length > 0) {
                const letrasDisponiveis = Object.keys(contagemLetras);
                letraEscolhida = letrasDisponiveis[Math.floor(Math.random() * letrasDisponiveis.length)];
              }
              
              if (letraEscolhida) {
                // Adiciona a letra ao conjunto de letras chutadas
                // Isso automaticamente revela TODAS as ocorrências da letra na palavra
                gameInstance.letrasChutadas.add(letraEscolhida);
                const novoEstado = gameInstance.getEstado();
                
                resultadoPoder = {
                  tipo: 'liberarLetra',
                  jogador: numeroJogador,
                  letra: letraEscolhida,
                  palavraAtualizada: novoEstado.palavra,
                  sucesso: true,
                  manterTurno: false // Passa o turno para o adversário
                };
                console.log(`🔓 Letra '${letraEscolhida}' revelada (todas as ${maxFrequencia} ocorrências) para jogador ${numeroJogador}`);
              } else {
                resultadoPoder = {
                  tipo: 'liberarLetra',
                  jogador: numeroJogador,
                  sucesso: false,
                  mensagem: 'Todas as letras já foram reveladas',
                  manterTurno: false // Passa o turno mesmo se falhar
                };
              }
            }
            break;
          }
            
          case 'ocultar_letra': {
            // Oculta uma letra da palavra do adversário
            const adversarioNum2 = numeroJogador === 1 ? 2 : 1;
            const gameInstanceAdversarioOcultar = game.gameInstances[adversarioNum2 - 1];
            if (gameInstanceAdversarioOcultar && gameInstanceAdversarioOcultar.status === 'jogando') {
              const palavraAdversario = gameInstanceAdversarioOcultar.getEstado().palavra;
              const letrasReveladas = [];
              
              for (let i = 0; i < palavraAdversario.length; i++) {
                if (palavraAdversario[i] !== '_' && palavraAdversario[i] !== ' ') {
                  letrasReveladas.push({
                    letra: palavraAdversario[i],
                    posicao: i
                  });
                }
              }
              
              if (letrasReveladas.length > 0) {
                const escolhida = letrasReveladas[Math.floor(Math.random() * letrasReveladas.length)];
                // Remove a letra do conjunto de letras chutadas (faz ela aparecer como oculta novamente)
                // Isso é mais complexo, então vamos usar uma abordagem diferente
                // Simplesmente notificamos o frontend para ocultar visualmente
                resultadoPoder = {
                  tipo: 'ocultarLetra',
                  jogador: numeroJogador,
                  alvo: adversarioNum2,
                  letra: escolhida.letra,
                  sucesso: true
                };
                console.log(`🔒 Letra '${escolhida.letra}' ocultada do adversário ${adversarioNum2}`);
              } else {
                resultadoPoder = {
                  tipo: 'ocultarLetra',
                  jogador: numeroJogador,
                  alvo: adversarioNum2,
                  sucesso: false,
                  mensagem: 'Nenhuma letra para ocultar'
                };
              }
            }
            break;
          }
            
          case 'ocultar_dica': {
            // Bloqueia a próxima dica do adversário
            const adversarioNum = numeroJogador === 1 ? 2 : 1;
            game.dicaBloqueada[adversarioNum] = true;
            resultadoPoder = {
              tipo: 'ocultarDica',
              jogador: numeroJogador,
              adversario: adversarioNum,
              sucesso: true
            };
            console.log(`🚫 Poder "Ocultar Dica" usado! Próxima dica do jogador ${adversarioNum} será bloqueada.`);
            break;
          }
            
          case 'palpite': {
            // Ativa o poder de palpite: quando o adversário chutar uma letra que você não chutou,
            // ela conta como erro na sua forca e não para o turno dele
            game.palpiteAtivo[numeroJogador] = true;
            resultadoPoder = {
              tipo: 'palpite',
              jogador: numeroJogador,
              sucesso: true,
              mensagem: 'Palpite ativado! Letras do adversário contarão como erro na sua forca',
              manterTurno: true // Indica que o turno deve ser mantido
            };
            console.log(`🎯 Poder de palpite ativado para jogador ${numeroJogador}. Turno mantido.`);
            break;
          }
            
          default: {
            resultadoPoder = {
              tipo: 'erro',
              sucesso: false,
              mensagem: `Poder '${poderId}' ainda não implementado`
            };
            console.warn(`⚠️ Poder desconhecido ou não implementado: ${poderId}`);
            break;
          }
        }
        
        // Remove o poder da lista de poderes disponíveis do jogador (para não usar novamente)
        jogadorAtual.poderes = jogadorAtual.poderes.filter(p => p !== poderId);
        console.log(`✅ Poder ${poderId} removido da lista de poderes disponíveis do jogador ${numeroJogador}`);
        
        // Se o poder deve manter o turno, não altera o turno
        // Caso contrário, o turno será trocado normalmente após o poder
        if (resultadoPoder?.manterTurno) {
          console.log(`🔄 Poder ${poderId} mantém o turno do jogador ${numeroJogador}`);
        }
        
        // Envia resultado do poder para o jogador que usou
        const eventoPoderUsado = {
          tipo: 'poderUsado',
          poderId: poderId,
          jogador: numeroJogador,
          resultado: resultadoPoder,
          vidas: vidasAtualizadas,
          sucesso: resultadoPoder?.sucesso !== false,
          manterTurno: resultadoPoder?.manterTurno || false,
          turno: game.turno // Envia o turno atual
        };
        
        // Se houve nova rodada, adiciona informações sobre as novas palavras e dicas
        if (resultadoPoder?.novaRodada) {
          eventoPoderUsado.novaPalavraJogador1 = resultadoPoder.novaPalavraJogador1;
          eventoPoderUsado.novaPalavraJogador2 = resultadoPoder.novaPalavraJogador2;
          eventoPoderUsado.dicasJogador1 = resultadoPoder.dicasJogador1 || [];
          eventoPoderUsado.dicasJogador2 = resultadoPoder.dicasJogador2 || [];
          eventoPoderUsado.novaRodada = true;
        }
        
        socket.emit('eventoJogo', eventoPoderUsado);
        
        // Notifica TODOS na sala sobre o poder usado e atualizações (vidas, etc)
        const eventoParaTodos = {
          tipo: 'poderUsadoGlobal',
          poderId: poderId,
          jogador: numeroJogador,
          vidas: vidasAtualizadas,
          // Não revela qual poder foi usado para o adversário, mas atualiza vidas se necessário
          atualizarVidas: resultadoPoder?.tipo === 'vidaExtra' || resultadoPoder?.tipo === 'tirarVida'
        };
        
        // Se houve nova rodada, adiciona informações sobre as novas palavras e dicas para todos
        if (resultadoPoder?.novaRodada) {
          eventoParaTodos.novaRodada = true;
          eventoParaTodos.novaPalavraJogador1 = resultadoPoder.novaPalavraJogador1;
          eventoParaTodos.novaPalavraJogador2 = resultadoPoder.novaPalavraJogador2;
          eventoParaTodos.dicasJogador1 = resultadoPoder.dicasJogador1 || [];
          eventoParaTodos.dicasJogador2 = resultadoPoder.dicasJogador2 || [];
        }
        
        io.to(roomId).emit('eventoJogo', eventoParaTodos);
        
        // Se for tirar vida ou vida extra, atualiza as vidas de todos
        if (resultadoPoder?.tipo === 'vidaExtra' || resultadoPoder?.tipo === 'tirarVida') {
          console.log(`📊 Vidas atualizadas: J1=${vidasAtualizadas[0]}, J2=${vidasAtualizadas[1]}`);
        }
        
        // Se o poder deve manter o turno, não troca o turno
        // O turno só é trocado se o poder não especificar manterTurno
        if (!resultadoPoder?.manterTurno) {
          // Para poderes que não mantêm o turno, troca o turno
          game.turno = game.turno === 1 ? 2 : 1;
          console.log(`🔄 Turno trocado após uso do poder ${poderId}. Novo turno: Jogador ${game.turno}`);
          
          // Emite evento de troca de turno para todos os jogadores
          io.to(roomId).emit('eventoJogo', {
            tipo: 'turnoTrocado',
            turno: game.turno,
            errosJogador1: game.gameInstances[0]?.erros || 0,
            errosJogador2: game.gameInstances[1]?.erros || 0,
            palavraJogador1: game.gameInstances[0]?.getPalavraParaExibir() || '',
            palavraJogador2: game.gameInstances[1]?.getPalavraParaExibir() || '',
            letrasChutadasJogador1: Array.from(game.gameInstances[0]?.letrasChutadas || []),
            letrasChutadasJogador2: Array.from(game.gameInstances[1]?.letrasChutadas || []),
            vidas: game.vidas
          });
        }
      }
      
      if (msg.tipo === 'poder') {
        // Mantido para compatibilidade (se houver código antigo usando este evento)
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
        const numeroJogadorDesconectado = jogador.numero;
        
        // Envia evento de desconexão para ambos os jogadores
        io.to(roomId).emit('eventoJogo', {
          tipo: 'jogadorDesconectado',
          jogadorDesconectado: numeroJogadorDesconectado,
          tempoReconexao: RECONNECT_GRACE_MS / 1000
        });
        
        jogador.remocaoTimeout = setTimeout(async () => {
          const aindaExiste = game.players.find(p => p.name === jogador.name);
          if (!aindaExiste || !aindaExiste.desconectado || aindaExiste.id !== socketIdParaRemocao) {
            return; // Jogador já reconectou ou foi removido
          }

          console.log(`⏱️ Tempo de reconexão esgotado para jogador ${jogador.name} (${numeroJogadorDesconectado}) na sala ${roomId}`);
          
          // Verifica se o jogo está ativo (já começou)
          // O jogo só está ativo se ambos os jogadores clicaram em "pronto"
          const jogoEstaAtivo = game.jogoIniciado === true;
          
            if (jogoEstaAtivo) {
            // Jogo está ativo - declara vitória do outro jogador por W.O.
            const adversarioNum = numeroJogadorDesconectado === 1 ? 2 : 1;
            const adversario = game.players.find(p => p.numero === adversarioNum);
            
            if (adversario) {
              console.log(`🏆 Jogador ${adversario.name} (${adversarioNum}) venceu por W.O. - adversário desconectou`);
              
              // Usa função centralizada para finalizar o jogo
              const eventoFim = await finalizarJogo(game, adversarioNum, 'wo');
              if (eventoFim) {
                // Envia evento para ambos os jogadores
                io.to(roomId).emit('eventoJogo', eventoFim);
              }
            }
          }
          
          // Remove o jogador desconectado
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

