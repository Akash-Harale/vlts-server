const { v4: uuidv4 } = require('uuid');

function requestIdMiddleware(req, res, next) {
  req.request_id = req.headers['x-request-id'] || uuidv4();
  next();
}

module.exports = requestIdMiddleware;

