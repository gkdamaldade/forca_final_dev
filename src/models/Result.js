
const { DataTypes, Model } = require('sequelize');

class Result extends Model {
  static initModel(sequelize) {
    Result.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        player_id: { type: DataTypes.INTEGER, allowNull: false },
        word_id: { type: DataTypes.INTEGER, allowNull: false },
        won: { type: DataTypes.BOOLEAN, allowNull: false },
        attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        errors: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        duration_ms: { type: DataTypes.INTEGER, allowNull: true }
      },
      { sequelize, modelName: 'Result', tableName: 'results' }
    );
    return Result;
  }
  static associate(models) {
    Result.belongsTo(models.Player, { foreignKey: 'player_id', as: 'player' });
    Result.belongsTo(models.Word, { foreignKey: 'word_id', as: 'word' });
  }
}
module.exports = Result;
