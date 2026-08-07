const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register({
    employee_id: req.body.employee_id,
    username: req.body.username,
    password: req.body.password,
    role_names: req.body.role_names || []
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

const signup = asyncHandler(async (req, res) => {
  const result = await authService.signupWithEmployeeEmail({
    email: req.body.email,
    password: req.body.password,
    role_names: []
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

const bootstrap = asyncHandler(async (req, res) => {
  const result = await authService.bootstrapAdmin({
    email: req.body.email,
    password: req.body.password,
    bootstrapToken: req.body.bootstrap_token
  });
  res.status(201).json({ success: true, data: result });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json({
    success: true,
    data: result
  });
});

const google = asyncHandler(async (req, res) => {
  const result = await authService.loginWithGoogle({
    idToken: req.body.idToken || req.body.credential
  });

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
  signup,
  bootstrap,
  login,
  google,
  me
};
