const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return /^Bearer$/i.test(scheme) ? token : null;
};

const makeDevUser = () => ({
  user_id: null,
  username: 'dev-system',
  roles: ['Admin'],
  permissions: ['manage_all'],
  isSystem: true
});

const authenticate = (options = {}) => (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    if (options.optional) return next();
    if (!env.authRequired) {
      req.user = makeDevUser();
      return next();
    }
    return next(new AppError('Authentication token is required', 401));
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret);
    return next();
  } catch (error) {
    return next(new AppError('Invalid or expired authentication token', 401));
  }
};

const hasAnyPermission = (user, permissions) => {
  if (!user) return false;
  const userPermissions = new Set(user.permissions || []);
  const userRoles = new Set(user.roles || []);

  if (userPermissions.has('manage_all') || userRoles.has('Admin')) return true;
  return permissions.some((permission) => userPermissions.has(permission));
};

const requireAnyPermission = (permissionSelector) => (req, res, next) => {
  const permissions = typeof permissionSelector === 'function' ? permissionSelector(req) : permissionSelector;
  const required = Array.isArray(permissions) ? permissions : [permissions];

  if (hasAnyPermission(req.user, required)) return next();

  return next(new AppError(`Missing permission: ${required.join(' or ')}`, 403));
};

const requireSelfOrAnyPermission = (permissionSelector, employeeParam = 'employeeId') => (req, res, next) => {
  const requestedEmployeeId = req.params[employeeParam];
  if (req.user && req.user.employee_id !== null && req.user.employee_id !== undefined
    && String(req.user.employee_id) === String(requestedEmployeeId)) {
    return next();
  }

  const permissions = typeof permissionSelector === 'function' ? permissionSelector(req) : permissionSelector;
  const required = Array.isArray(permissions) ? permissions : [permissions];
  if (hasAnyPermission(req.user, required)) return next();
  return next(new AppError(`Missing permission: ${required.join(' or ')}`, 403));
};

module.exports = {
  authenticate,
  requireAnyPermission,
  requireSelfOrAnyPermission,
  hasAnyPermission
};
