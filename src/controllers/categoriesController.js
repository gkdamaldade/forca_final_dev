
const { listCategories } = require('../services/categoryService');

async function list(req, res, next) {
  try {
    const data = await listCategories();
    res.json(data);
  } catch (err) { next(err); }
}

module.exports = { list };
