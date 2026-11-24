const reportService = require('../services/reportService');
const asyncHandler = require('../utils/asyncHandler');
const { hasAnyPermission } = require('../middleware/auth');

const getOverview = asyncHandler(async (req, res) => {
  const access = {
    includePayroll: hasAnyPermission(req.user, ['view_payroll', 'manage_payroll', 'process_payroll']),
    includeGrievances: hasAnyPermission(req.user, ['resolve_grievance', 'view_grievances', 'manage_org'])
  };

  const data = await reportService.getOverview(req.query, access);
  res.json({ success: true, data });
});

module.exports = {
  getOverview
};
