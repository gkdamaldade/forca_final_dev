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
    this.hasMany(models.Result, { foreignKey: 'sala_id', as: 'results' });
    this.hasMany(models.GameM, { foreignKey: 'sala_id', as: 'games' }); // se quiser vincular jogos à sala
  }
}

module.exports = Sala; // << importante: exporte a classe diretamente

