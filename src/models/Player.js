// src/models/Player.js
const { Model, DataTypes } = require('sequelize');

class Player extends Model {
  static initModel(sequelize) {
    Player.init({
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      nome: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      email: {
        type: DataTypes.STRING(180),
        unique: true,
        allowNull: false // Assumindo que email também é obrigatório
      },
      // --- ADICIONE ESTE CAMPO ---
      senha_hash: {
        type: DataTypes.STRING,
        allowNull: false
      },
      moedas: {
          type: DataTypes.INTEGER,
          defaultValue: 0
      },
      vitorias: {
          type: DataTypes.INTEGER,
          defaultValue: 0
      }
    },{
      sequelize,
      tableName: 'usuario', // Garante que o nome da tabela está correto
      modelName: 'Player',
      timestamps: false
    });
    return Player;
  }
}

module.exports = Player;
