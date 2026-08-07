const express = require('express');
const authController = require('../controllers/authController');
const { authenticate, requireAnyPermission } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/bootstrap', authLimiter, authController.bootstrap);
router.post('/register', authenticate(), requireAnyPermission(['manage_all']), authController.register);
router.post('/signup', authLimiter, authController.signup);
router.post('/login', authLimiter, authController.login);
router.post('/google', authLimiter, authController.google);
router.get('/me', authenticate(), authController.me);

module.exports = router;
