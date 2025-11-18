const { Partida, Rodada, Word } = require('../models').default;

async function startPartida({ player1_id, player2_id, wordId }) {
  const word = await Word.findByPk(wordId);
  if (!word) throw new Error('Palavra não encontrada.');

  const partida = await Partida.create({
    player1_id,
    player2_id,
    wordId,
    turno_atual: player1_id,
    status: 'jogando'
  });

  // cria primeira rodada
  await Rodada.create({
    partidaId: partida.id,
    jogadorId: player1_id,
    erros: 0,
    tentativas: 0
  });

  return partida;
}

async function playRodada({ partidaId, player_id, letra }) {
  const partida = await Partida.findByPk(partidaId);
  if (!partida) throw new Error('Partida não encontrada.');

  if (partida.turno_atual !== player_id) {
    throw new Error('Não é o turno deste jogador.');
  }

  // busca rodada atual
  let rodada = await Rodada.findOne({ where: { partidaId, jogadorId: player_id } });
  if (!rodada) {
    rodada = await Rodada.create({ partidaId, jogadorId: player_id, erros: 0, tentativas: 0 });
  }

  // atualiza rodada (tentativa + lógica de acerto/erro)
  rodada.tentativas += 1;
  // aqui você adiciona a lógica de verificar se a letra está na palavra
  await rodada.save();

  // alterna turno
  partida.turno_atual = (player_id === partida.player1_id ? partida.player2_id : partida.player1_id);
  await partida.save();

  return { partida, rodada };
}

module.exports = { startPartida, playRodada };
