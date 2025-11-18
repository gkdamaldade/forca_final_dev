
function errorHandler(err, req, res, next) {
  if (err && err.error && err.error.isJoi) {
    return res.status(400).json({
      message: 'Erro de validação.',
      details: err.error.details.map(d => d.message)
    });
  }
  console.error(err);
  res.status(500).json({ message: 'Erro interno. Tente novamente mais tarde.' });
}
module.exports = { errorHandler };
