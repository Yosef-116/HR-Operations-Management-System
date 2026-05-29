const express = require('express');
const authRoutes = require('./authRoutes');
const resourceRoutes = require('./resourceRoutes');
const workflowRoutes = require('./workflowRoutes');
const resourceController = require('../controllers/resourceController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use('/auth', authRoutes);
router.get('/resources', authenticate(), resourceController.listResources);
router.use('/data', authenticate(), resourceRoutes);
router.use('/workflows', authenticate(), workflowRoutes);

module.exports = router;
