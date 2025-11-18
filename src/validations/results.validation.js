
const { Joi } = require('express-validation');

const createResult = {
  body: Joi.object({
    playerName: Joi.string().allow(null, ''),
    playerEmail: Joi.string().email().allow(null, ''),
    wordId: Joi.number().integer().required(),
    won: Joi.boolean().required(),
    attempts: Joi.number().integer().min(0).default(0),
    errors: Joi.number().integer().min(0).default(0),
    durationMs: Joi.number().integer().min(0).allow(null)
  }).custom((value, helpers) => {
    if (!value.playerName && !value.playerEmail) {
      return helpers.error('any.custom', 'Informe playerName ou playerEmail');
    }
    return value;
  }, 'player identity check')
};

module.exports = { createResult };
