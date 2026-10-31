const config = require('../config');

// Safe, consistent JSON error handler middleware
function errorHandler(err, req, res, next) {
  // Check for body-parser syntax error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload' });
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = (statusCode === 500 && config.env === 'production')
    ? 'An unexpected server error occurred'
    : (err.message || 'Internal server error');

  if (statusCode >= 500 && config.env !== 'test') {
    console.error('Server Error:', err);
  }

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
