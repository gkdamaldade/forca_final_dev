
const { Router } = require('express');
const { getRandom } = require('../controllers/wordsController');

const router = Router();
router.get('/random', getRandom);

module.exports = router;
