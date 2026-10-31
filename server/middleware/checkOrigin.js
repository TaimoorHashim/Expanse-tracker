const config = require('../config');

/**
 * CSRF Guard: Checks Origin / Referer for state-changing HTTP requests.
 */
function checkOrigin(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // During automated unit testing or if Origin check is bypassed in tests
  if (process.env.NODE_ENV === 'test' && !req.headers.origin && !req.headers.referer) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  // If no origin/referer is supplied on state-changing request
  if (!requestOrigin) {
    // In development mode, allow API clients (curl/Postman) or local browsers
    if (config.env === 'development') {
      return next();
    }
    return res.status(403).json({ error: 'Origin header missing' });
  }

  const allowedOrigins = [
    config.appOrigin,
    `http://localhost:${config.port}`,
    `http://127.0.0.1:${config.port}`
  ];

  const isAllowed = allowedOrigins.some(allowed => {
    try {
      return new URL(allowed).origin === new URL(requestOrigin).origin;
    } catch {
      return false;
    }
  });

  if (!isAllowed) {
    return res.status(403).json({ error: 'Forbidden: Invalid request origin' });
  }

  next();
}

module.exports = checkOrigin;
