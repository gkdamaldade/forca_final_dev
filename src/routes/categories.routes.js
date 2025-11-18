
const { Router } = require('express');
const { list } = require('../controllers/categoriesController');

const router = Router();
router.get('/', list);

module.exports = router;
