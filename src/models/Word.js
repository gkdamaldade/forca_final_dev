
const { DataTypes, Model } = require('sequelize');

class Word extends Model {
  static initModel(sequelize) {
    Word.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        text: { type: DataTypes.STRING(120), allowNull: false },
        hint: { type: DataTypes.STRING(255), allowNull: true },
        active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        category_id: { type: DataTypes.INTEGER, allowNull: false }
      },
      { sequelize, modelName: 'Word', tableName: 'words' }
    );
    return Word;
  }
  static associate(models) {
    Word.belongsTo(models.Category, { foreignKey: 'category_id', as: 'category' });
  }
}
module.exports = Word;
