// src/models/ItemLoja.js
const { Model, DataTypes } = require('sequelize');

class ItemLoja extends Model {
  static initModel(sequelize) {
    ItemLoja.init({
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      nome: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      descricao: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      tipo_poder: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      custo_moedas: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      imagem: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    }, {
      sequelize,
      tableName: 'itemloja',
      modelName: 'ItemLoja',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    });
    return ItemLoja;
  }

  static associate(models) {
    ItemLoja.hasMany(models.Inventario, {
      foreignKey: 'itemloja_id',
      as: 'inventarios'
    });
  }
}

module.exports = ItemLoja;

