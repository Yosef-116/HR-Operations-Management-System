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
  if (!resource) {
    return next(new AppError(`Unknown resource: ${req.params.schema}.${req.params.table}`, 404));
  }

  req.resource = resource;
  const required = permissionsFor(action, resource);
  if (hasAnyPermission(req.user, required)) return next();

  return next(new AppError(`Missing permission for ${action} on ${resource.key}`, 403));
};

module.exports = {
  authorizeResource,
  permissionsFor
};
