
const { sequelize } = require('../db/sequelize');

const Category = require('./Category');
const Word = require('./Word');
const Player = require('./Player');
const Result = require('./Result');
const Sala = require('./Sala');
const GameM = require('./GameM');


const models = {};
models.Category = Category.initModel(sequelize);
models.Word = Word.initModel(sequelize);
models.Player = Player.initModel(sequelize);
models.Result = Result.initModel(sequelize);
models.Sala = Sala.initModel(sequelize);
models.GameM = GameM.initModel(sequelize);

GameM.associate?.(models);
Word.associate?.(models);
Result.associate?.(models);
models.Category.hasMany(models.Word, { foreignKey: 'category_id', as: 'words' });

module.exports = { sequelize, models };
