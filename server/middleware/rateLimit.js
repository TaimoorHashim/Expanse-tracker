const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTest ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many account registrations. Please try again later.' }
});

module.exports = {
  loginLimiter,
  registerLimiter
};
