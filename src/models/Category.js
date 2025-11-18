
const { DataTypes, Model } = require('sequelize');

class Category extends Model {
  static initModel(sequelize) {
    Category.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
        slug: { type: DataTypes.STRING(120), allowNull: true, unique: true },
        active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
      },
      { sequelize, modelName: 'Category', tableName: 'categories' }
    );
    return Category;
  }
}
module.exports = Category;
