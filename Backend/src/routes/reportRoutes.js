const express = require('express');
const reportController = require('../controllers/reportController');
const { requireAnyPermission } = require('../middleware/auth');

const router = express.Router();

const REPORTS_ACCESS_PERMISSIONS = [
  'view_reports',
  'view_org',
  'view_payroll',
  'manage_payroll',
  'process_payroll',
  'manage_org'
];

router.get('/overview', requireAnyPermission(REPORTS_ACCESS_PERMISSIONS), reportController.getOverview);

module.exports = router;
