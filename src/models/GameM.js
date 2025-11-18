const { DataTypes } = require('sequelize');

class Game {
  static initModel(sequelize) {
    const GameModel = sequelize.define('Game', {
      word: {
        type: DataTypes.STRING,
        allowNull: false
      },
      player1_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      player2_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      turno_atual: {
        type: DataTypes.INTEGER, // 1 ou 2
        defaultValue: 1
      },
      estado: {
        type: DataTypes.TEXT, // estado serializado (letras, erros etc.)
        defaultValue: ''
      },
      status_final: {
        type: DataTypes.STRING, // 'vitoria' | 'derrota' | 'cancelada'
        allowNull: true
      },
      vencedor_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      tableName: 'games'
    });
    return GameModel;
  }

  static associate(models) {
    // Se quiser: relacionar com Player
    Game.belongsTo(models.Player, { as: 'player1', foreignKey: 'player1_id' });
    Game.belongsTo(models.Player, { as: 'player2', foreignKey: 'player2_id' });
  }
}

module.exports = Game;

