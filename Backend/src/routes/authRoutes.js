const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', authenticate({ optional: true }), authController.register);
router.post('/signup', authenticate({ optional: true }), authController.signup);
router.post('/login', authController.login);
router.post('/google', authController.google);
router.get('/me', authenticate(), authController.me);

module.exports = router;
