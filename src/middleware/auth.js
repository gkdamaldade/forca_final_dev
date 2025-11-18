
const { expressjwt: jwt } = require('express-jwt');

const auth = jwt({
  secret: process.env.JWT_SECRET,
  audience: process.env.JWT_AUDIENCE,
  issuer: process.env.JWT_ISSUER,
  algorithms: ['HS256']
});

module.exports = { auth };
