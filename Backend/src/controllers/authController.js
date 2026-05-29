const authService = require('../services/authService');
const { hasAnyPermission } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
  const userCount = await authService.getUserCount();
  const canAssignRoles = userCount === 0 || hasAnyPermission(req.user, ['manage_all']);

  const result = await authService.register({
    employee_id: req.body.employee_id,
    username: req.body.username,
    password: req.body.password,
    role_names: canAssignRoles ? (req.body.role_names || []) : []
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json({
    success: true,
    data: result
  });
});

const me = asyncHandler(async (req, res) => {
  const profile = await authService.getUserProfile(req.user.user_id);
  res.json({
    success: true,
    data: profile
  });
});

module.exports = {
  register,
  login,
  me
};
