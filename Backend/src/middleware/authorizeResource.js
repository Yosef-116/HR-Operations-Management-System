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
  const employeeId = req.user && req.user.employee_id;

  // A resource-level permission is broader than self-service access and must
  // win here; otherwise admins and HR staff would accidentally be restricted
  // to their own records.
  if (hasAnyPermission(req.user, required)) return next();

  // Self-service access must be constrained in the data query, not merely by a
  // permission name.  The generic endpoint otherwise exposes every employee's
  // records to a user who is allowed to see only their own.
  const selfServiceRules = {
    'org.employee': { view: 'view_self' },
    'payroll.leave_requests': { view: 'request_leave', create: 'request_leave' },
    'payroll.expense_claims': { view: 'submit_expense', create: 'submit_expense' }
  };
  const selfPermission = selfServiceRules[resource.key] && selfServiceRules[resource.key][action];
  if (selfPermission && employeeId && hasAnyPermission(req.user, [selfPermission])) {
    req.resourceScope = { employee_id: employeeId };
    return next();
  }

  return next(new AppError(`Missing permission for ${action} on ${resource.key}`, 403));
};

module.exports = {
  authorizeResource,
  permissionsFor
};
