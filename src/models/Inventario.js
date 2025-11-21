// src/models/Inventario.js
const { Model, DataTypes } = require('sequelize');

class Inventario extends Model {
  static initModel(sequelize) {
    Inventario.init({
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'usuario',
          key: 'id'
        }
      },
      itemloja_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'itemloja',
          key: 'id'
        }
      },
      quantidade: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      }
    }, {
      sequelize,
      tableName: 'inventario',
      modelName: 'Inventario',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    });
    return Inventario;
  }

  static associate(models) {
    Inventario.belongsTo(models.Player, {
      foreignKey: 'usuario_id',
      as: 'usuario'
    });
    Inventario.belongsTo(models.ItemLoja, {
      foreignKey: 'itemloja_id',
      as: 'itemLoja'
    });
  }
}

module.exports = Inventario;

