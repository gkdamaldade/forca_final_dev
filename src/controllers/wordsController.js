
const { getRandomWord } = require('../services/wordService');

async function getRandom(req, res, next) {
  try {
    const { categoryId, category } = req.query;
    const word = await getRandomWord({ categoryId, category, onlyActive: true });
    if (!word) return res.status(404).json({ message: 'Nenhuma palavra encontrada.' });
    res.json({
      id: word.id,
      text: word.text,
      hint: word.hint,
      category: word.category ? { id: word.category.id, name: word.category.name, slug: word.category.slug } : null
    });
  } catch (err) { next(err); }
}

module.exports = { getRandom };
