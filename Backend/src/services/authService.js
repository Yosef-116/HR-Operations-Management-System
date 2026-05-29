const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const { CORE_ROLES } = require('../config/permissions');
const AppError = require('../utils/AppError');

const publicUserFields = `
  ua.user_id,
  ua.employee_id,
  ua.username,
  ua.last_login,
  ua.is_active,
  ua.created_at
`;

const getUserProfile = async (userId, client = null) => {
  const executor = client || db;
  const result = await executor.query(
    `SELECT
       ${publicUserFields},
       COALESCE(array_agg(DISTINCT r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles,
       COALESCE(array_agg(DISTINCT rp.permission_name) FILTER (WHERE rp.permission_name IS NOT NULL), '{}') AS permissions
     FROM auth.user_accounts ua
     LEFT JOIN auth.user_roles ur ON ur.user_id = ua.user_id
     LEFT JOIN auth.roles r ON r.role_id = ur.role_id
     LEFT JOIN auth.role_permissions rp ON rp.role_id = r.role_id
     WHERE ua.user_id = $1 AND ua.is_deleted = false
     GROUP BY ua.user_id`,
    [userId]
  );
  return result.rows[0] || null;
};

const signToken = (profile) => jwt.sign(
  {
    user_id: profile.user_id,
    employee_id: profile.employee_id,
    username: profile.username,
    roles: profile.roles || [],
    permissions: profile.permissions || []
  },
  env.jwtSecret,
  { expiresIn: env.jwtExpiresIn }
);

const getUserCount = async (client = null) => {
  const executor = client || db;
  const result = await executor.query('SELECT COUNT(*)::int AS total FROM auth.user_accounts WHERE is_deleted = false');
  return result.rows[0].total;
};

const ensureRole = async (roleName, client) => {
  const result = await client.query(
    `INSERT INTO auth.roles (role_name)
     VALUES ($1)
     ON CONFLICT (role_name) DO UPDATE SET role_name = EXCLUDED.role_name
     RETURNING role_id`,
    [roleName]
  );
  return result.rows[0].role_id;
};

const ensurePermission = async (roleId, permissionName, client) => {
  const exists = await client.query(
    'SELECT 1 FROM auth.role_permissions WHERE role_id = $1 AND permission_name = $2 LIMIT 1',
    [roleId, permissionName]
  );
  if (exists.rowCount) return;

  await client.query(
    'INSERT INTO auth.role_permissions (role_id, permission_name) VALUES ($1, $2)',
    [roleId, permissionName]
  );
};

const assignRole = async (userId, roleId, client) => {
  const exists = await client.query(
    'SELECT 1 FROM auth.user_roles WHERE user_id = $1 AND role_id = $2 LIMIT 1',
    [userId, roleId]
  );
  if (exists.rowCount) return;

  await client.query(
    'INSERT INTO auth.user_roles (user_id, role_id) VALUES ($1, $2)',
    [userId, roleId]
  );
};

const seedCoreRoles = async (client) => {
  const roleIds = {};
  for (const role of CORE_ROLES) {
    const roleId = await ensureRole(role.roleName, client);
    roleIds[role.roleName] = roleId;
    for (const permission of role.permissions) {
      await ensurePermission(roleId, permission, client);
    }
  }
  return roleIds;
};

const register = async ({ employee_id, username, password, role_names = [] }) => {
  if (!username || !password) {
    throw new AppError('username and password are required', 400);
  }

  return db.withTransaction(async (client) => {
    const existing = await client.query(
      'SELECT 1 FROM auth.user_accounts WHERE username = $1 AND is_deleted = false LIMIT 1',
      [username]
    );
    if (existing.rowCount) {
      throw new AppError('Username already exists', 409);
    }

    const userCount = await getUserCount(client);
    const roleIds = await seedCoreRoles(client);
    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);

    const created = await client.query(
      `INSERT INTO auth.user_accounts (employee_id, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING user_id`,
      [employee_id || null, username, passwordHash]
    );

    const userId = created.rows[0].user_id;
    const namesToAssign = userCount === 0 ? ['Admin'] : (role_names.length ? role_names : ['Employee']);

    for (const roleName of namesToAssign) {
      const roleId = roleIds[roleName] || await ensureRole(roleName, client);
      await assignRole(userId, roleId, client);
    }

    const profile = await getUserProfile(userId, client);
    return {
      user: profile,
      token: signToken(profile)
    };
  });
};

const login = async ({ username, password }) => {
  if (!username || !password) {
    throw new AppError('username and password are required', 400);
  }

  const result = await db.query(
    `SELECT user_id, username, password_hash, is_active
     FROM auth.user_accounts
     WHERE username = $1 AND is_deleted = false
     LIMIT 1`,
    [username]
  );

  const user = result.rows[0];
  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    throw new AppError('Invalid username or password', 401);
  }

  if (!user.is_active) {
    throw new AppError('Account is disabled', 403);
  }

  await db.query('UPDATE auth.user_accounts SET last_login = now() WHERE user_id = $1', [user.user_id]);
  const profile = await getUserProfile(user.user_id);

  return {
    user: profile,
    token: signToken(profile)
  };
};

module.exports = {
  register,
  login,
  getUserProfile,
  getUserCount,
  seedCoreRoles,
  signToken
};
