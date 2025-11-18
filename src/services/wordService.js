
const { sequelize, models } = require('../models').default;

async function getRandomWord({ categoryId, category, onlyActive = true }) {
  const where = {};
  if (onlyActive) where.active = true;

  const include = [];
  if (categoryId || category) {
    include.push({
      model: models.Category,
      as: 'category',
      required: true,
      where: {
        ...(categoryId ? { id: Number(categoryId) } : {}),
        ...(category ? { slug: category } : {})
      },
      attributes: ['id', 'name', 'slug']
    });
  } else {
    include.push({ model: models.Category, as: 'category', required: false, attributes: ['id', 'name', 'slug'] });
  }

  const word = await models.Word.findOne({ where, include, order: [[sequelize.random()]] });
  return word;
}

module.exports = { getRandomWord };
