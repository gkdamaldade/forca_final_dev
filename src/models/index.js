
const { sequelize } = require('../db/sequelize');

const Category = require('./Category');
const Word = require('./Word');
const Player = require('./Player');
const Result = require('./Result');
const Sala = require('./Sala');
const GameM = require('./GameM');
const Inventario = require('./Inventario');
const ItemLoja = require('./ItemLoja');
const Dica = require('./Dica');


const models = {};
models.Category = Category.initModel(sequelize);
models.Word = Word.initModel(sequelize);
models.Player = Player.initModel(sequelize);
models.Result = Result.initModel(sequelize);
models.Sala = Sala.initModel(sequelize);
models.GameM = GameM.initModel(sequelize);
models.Inventario = Inventario.initModel(sequelize);
models.ItemLoja = ItemLoja.initModel(sequelize);
models.Dica = Dica.initModel(sequelize);


Object.values(models).forEach(model => {
  if (typeof model.associate === 'function') {
    model.associate(models);
  }
});

// Associação comentada porque o modelo Word usa 'categoria' como string, não 'category_id' como foreign key
// Se no futuro o modelo Word for alterado para usar category_id, descomente esta linha:
// models.Category.hasMany(models.Word, { foreignKey: 'category_id', as: 'words' });

module.exports = { sequelize, models };
