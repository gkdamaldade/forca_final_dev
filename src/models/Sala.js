const { Model, DataTypes } = require('sequelize');

class Sala extends Model {
  static initModel(sequelize) {
    return Sala.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        codigo: { type: DataTypes.STRING, allowNull: false, unique: true },
        categoria: { type: DataTypes.TEXT, allowNull: false},
      },
      {
        sequelize,
        modelName: 'Sala',
        tableName: 'salas',
        timestamps: false,
      }
    );
  }

  static associate(models) {
    // ajuste conforme seu domínio
    this.hasMany(models.Player, { foreignKey: 'sala_id', as: 'players' });
    this.hasMany(models.Result, { foreignKey: 'sala_id', as: 'results' });
  }
}

module.exports = Sala; // << importante: exporte a classe diretamente

