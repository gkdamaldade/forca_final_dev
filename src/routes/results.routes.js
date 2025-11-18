
const { Router } = require('express');
const { validate } = require('express-validation');
const { createResult } = require('../validations/results.validation');
const { create, leaderboard } = require('../controllers/resultsController');

const router = Router();
router.post('/', validate(createResult), create);
router.get('/leaderboard', leaderboard);

module.exports = router;
