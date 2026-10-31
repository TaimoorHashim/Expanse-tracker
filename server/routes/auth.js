const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const config = require('../config');
const { validateAuthInput } = require('../validators/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Dummy hash used for constant-time comparison on nonexistent user
const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012';

/**
 * POST /api/auth/register
 */
router.post('/register', registerLimiter, validateAuthInput, async (req, res, next) => {
  try {
    if (!config.registrationOpen) {
      return res.status(403).json({ error: 'Registration is currently closed' });
    }

    const email = req.body.normalizedEmail;
    const { password } = req.body;

    // Check if user already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email, passwordHash]
    );

    const userId = result.insertId;

    // Initialize session
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.userId = userId;
      req.session.userEmail = email;
      res.status(201).json({
        user: { id: userId, email }
      });
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', loginLimiter, validateAuthInput, async (req, res, next) => {
  try {
    const email = req.body.normalizedEmail;
    const { password } = req.body;

    const [rows] = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = ?',
      [email]
    );

    const user = rows[0];
    const hashToCompare = user ? user.password_hash : DUMMY_HASH;
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.userEmail = user.email;
      res.json({
        user: { id: user.id, email: user.email }
      });
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res, next) => {
  if (!req.session) {
    return res.json({ message: 'Logged out successfully' });
  }

  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

/**
 * GET /api/auth/me
 */
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({
    user: {
      id: req.session.userId,
      email: req.session.userEmail
    }
  });
});

module.exports = router;
