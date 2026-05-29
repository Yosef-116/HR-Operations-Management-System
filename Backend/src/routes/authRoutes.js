const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/register', authenticate({ optional: true }), authController.register);
router.post('/signup', authenticate({ optional: true }), authController.signup);
router.post('/login', authLimiter, authController.login);
router.post('/google', authLimiter, authController.google);
router.get('/me', authenticate(), authController.me);

module.exports = router;
