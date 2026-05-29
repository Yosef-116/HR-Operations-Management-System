const rateLimit = require('express-rate-limit');

// 20 login attempts per IP per 15-minute window.
// Applied to /auth/login and /auth/google to prevent brute-force attacks.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.'
  }
});

module.exports = { authLimiter };
