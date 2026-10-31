/**
 * Blocks requests without a valid session and attaches req.user
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.user = {
    id: req.session.userId,
    email: req.session.userEmail
  };

  next();
}

module.exports = requireAuth;
