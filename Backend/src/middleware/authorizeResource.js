const { getResource } = require('../config/resources');
const { hasAnyPermission } = require('./auth');
const AppError = require('../utils/AppError');

const permissionsFor = (action, resource) => [
  `${action}_${resource.table}`,
  `${action}_${resource.schema}`,
  `${action}_${resource.schema}.${resource.table}`,
  `manage_${resource.schema}`
];

const authorizeResource = (action) => (req, res, next) => {
  const resource = getResource(req.params.schema, req.params.table);
  if (!resource) return next(new AppError(`Unknown resource: ${req.params.schema}.${req.params.table}`, 404));

  req.resource = resource;
  const required = permissionsFor(action, resource);

  // Allow employees to read org data (their own record) and create payroll entries
  if (action === 'view' && resource.schema === 'org') required.push('view_self');
  if (action === 'create' && resource.schema === 'payroll') required.push('submit_expense', 'request_leave');

  if (hasAnyPermission(req.user, required)) return next();
  return next(new AppError(`Missing permission for ${action} on ${resource.key}`, 403));
};

module.exports = {
  authorizeResource,
  permissionsFor
};
