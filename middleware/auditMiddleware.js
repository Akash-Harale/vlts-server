const { v4: uuidv4 } = require('uuid');

function auditMiddleware(req, res, next) {
  req.trace_id = uuidv4();
  next();
}

module.exports = auditMiddleware;
