
const { expressjwt: jwt } = require('express-jwt');

const auth = jwt({
  secret: process.env.JWT_SECRET,
  audience: process.env.JWT_AUDIENCE,
  issuer: process.env.JWT_ISSUER,
  algorithms: ['HS256']
});
// middleware/auth.js
module.exports = function (req, res, next) {
  // sua lógica de autenticação aqui
  // se estiver tudo certo:
  next();
};

