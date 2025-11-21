const { Model, DataTypes } = require('sequelize');

class Word extends Model {
  static initModel(sequelize) {
    Word.init({
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      palavra: {
        type: DataTypes.STRING,
        allowNull: false
      },
      categoria: {
        type: DataTypes.STRING,
        allowNull: false
      },
      dificuldade: {
        type: DataTypes.STRING,
        allowNull: false
      },
      usada: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    }, {
      sequelize,
      tableName: "palavra",
      modelName: "Palavra",
      timestamps: false
    });

    return Word;
  }

  static associate(models) {
    // Associação com Dica
    Word.hasMany(models.Dica, {
      foreignKey: 'palavra_id',
      as: 'dicas'
    });
  }
}

module.exports = Word;
