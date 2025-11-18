
const { models } = require('../models');

async function listCategories() {
  return models.Category.findAll({
    where: { active: true },
    attributes: ['id', 'name', 'slug'],
    order: [['name', 'ASC']]
  });
}

module.exports = { listCategories };
