const { Model, DataTypes } = require('sequelize');

class Dica extends Model {
  static initModel(sequelize) {
    Dica.init({
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      palavra_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'palavra',
          key: 'id'
        }
      },
      texto_dica: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      ordem: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: "dica",
      modelName: "Dica",
      timestamps: false
    });

    return Dica;
  }

  static associate(models) {
    // Associação com Word (Palavra)
    Dica.belongsTo(models.Word, {
      foreignKey: 'palavra_id',
      as: 'palavra'
    });
  }
}

module.exports = Dica;

