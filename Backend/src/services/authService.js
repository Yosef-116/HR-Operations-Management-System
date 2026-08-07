const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const { CORE_ROLES } = require('../config/permissions');
const AppError = require('../utils/AppError');

const googleClient = new OAuth2Client();
const coreRoleNames = new Set(CORE_ROLES.map((role) => role.roleName));

// Used for timing-safe login: always run bcrypt even when the user is not found,
// so response time does not reveal whether a username/email exists.
const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345';

const publicUserFields = `
  ua.user_id,
  ua.employee_id,
  e.email,
  e.f_name,
  e.l_name,
  e.employment_status,
  ua.username,
  ua.last_login,
  ua.is_active,
  ua.created_at
`;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const getUserProfile = async (userId, client = null) => {
  const executor = client || db;
  const result = await executor.query(
    `SELECT
       ${publicUserFields},
       COALESCE(array_agg(DISTINCT r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles,
       COALESCE(array_agg(DISTINCT rp.permission_name) FILTER (WHERE rp.permission_name IS NOT NULL), '{}') AS permissions
     FROM hr_auth.user_accounts ua
     LEFT JOIN org.employee e ON e.employee_id = ua.employee_id
     LEFT JOIN hr_auth.user_roles ur ON ur.user_id = ua.user_id
     LEFT JOIN hr_auth.roles r ON r.role_id = ur.role_id
     LEFT JOIN hr_auth.role_permissions rp ON rp.role_id = r.role_id
     WHERE ua.user_id = $1 AND ua.is_deleted = false
     GROUP BY ua.user_id, e.employee_id, e.email, e.f_name, e.l_name, e.employment_status`,
    [userId]
  );
  return result.rows[0] || null;
};

const signToken = (profile) => jwt.sign(
  {
    user_id: profile.user_id,
    employee_id: profile.employee_id,
    email: profile.email,
    username: profile.username,
    roles: profile.roles || [],
    permissions: profile.permissions || []
  },
  env.jwtSecret,
  { expiresIn: env.jwtExpiresIn }
);

const getUserCount = async (client = null) => {
  const executor = client || db;
  const result = await executor.query('SELECT COUNT(*)::int AS total FROM hr_auth.user_accounts WHERE is_deleted = false');
  return result.rows[0].total;
};

const findEmployeeByEmail = async (email, client = null) => {
  const executor = client || db;
  const result = await executor.query(
    `SELECT employee_id, f_name, l_name, email, employment_status, is_deleted
     FROM org.employee
     WHERE lower(email) = $1 AND COALESCE(is_deleted, false) = false
     LIMIT 1`,
    [normalizeEmail(email)]
  );
  return result.rows[0] || null;
};

const findEmployeeById = async (employeeId, client = null) => {
  const executor = client || db;
  const result = await executor.query(
    `SELECT employee_id, f_name, l_name, email, employment_status, is_deleted
     FROM org.employee
     WHERE employee_id = $1
     LIMIT 1`,
    [employeeId]
  );
  return result.rows[0] || null;
};

const ensureEmployeeCanUseAuth = (employee) => {
  if (!employee) {
    throw new AppError('No active employee record exists for this email address', 403);
  }

  if (employee.employment_status && employee.employment_status !== 'Active') {
    throw new AppError(`Employee account is not active: ${employee.employment_status}`, 403);
  }
};

const validateRoleNames = (roleNames) => {
  if (!Array.isArray(roleNames) || !roleNames.length) return ['Employee'];
  const uniqueRoles = [...new Set(roleNames)];
  const unknown = uniqueRoles.filter((role) => !coreRoleNames.has(role));
  if (unknown.length) {
    throw new AppError(`Unknown role(s): ${unknown.join(', ')}`, 400);
  }
  return uniqueRoles;
};

const tokensMatch = (provided, expected) => {
  const providedBuffer = Buffer.from(String(provided || ''));
  const expectedBuffer = Buffer.from(String(expected || ''));
  return providedBuffer.length === expectedBuffer.length
    && expectedBuffer.length > 0
    && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

const ensureRole = async (roleName, client) => {
  const result = await client.query(
    `INSERT INTO hr_auth.roles (role_name)
     VALUES ($1)
     ON CONFLICT (role_name) DO UPDATE SET role_name = EXCLUDED.role_name
     RETURNING role_id`,
    [roleName]
  );
  return result.rows[0].role_id;
};

const ensurePermission = async (roleId, permissionName, client) => {
  const exists = await client.query(
    'SELECT 1 FROM hr_auth.role_permissions WHERE role_id = $1 AND permission_name = $2 LIMIT 1',
    [roleId, permissionName]
  );
  if (exists.rowCount) return;

  await client.query(
    'INSERT INTO hr_auth.role_permissions (role_id, permission_name) VALUES ($1, $2)',
    [roleId, permissionName]
  );
};

const assignRole = async (userId, roleId, client) => {
  const exists = await client.query(
    'SELECT 1 FROM hr_auth.user_roles WHERE user_id = $1 AND role_id = $2 LIMIT 1',
    [userId, roleId]
  );
  if (exists.rowCount) return;

  await client.query(
    'INSERT INTO hr_auth.user_roles (user_id, role_id) VALUES ($1, $2)',
    [userId, roleId]
  );
};

const seedCoreRoles = async (client) => {
  const roleIds = {};
  for (const role of CORE_ROLES) {
    const roleId = await ensureRole(role.roleName, client);
    roleIds[role.roleName] = roleId;
    // Core roles are application policy. Reconcile removed permissions as well
    // as adding new ones, so a role change takes effect for existing accounts.
    await client.query(
      `DELETE FROM hr_auth.role_permissions
       WHERE role_id = $1 AND NOT (permission_name = ANY($2::text[]))`,
      [roleId, role.permissions]
    );
    for (const permission of role.permissions) {
      await ensurePermission(roleId, permission, client);
    }
  }
  return roleIds;
};

const createAccountForEmployee = async ({ employee, password, roleNames = [] }, client) => {
  const existingByEmployee = await client.query(
    `SELECT user_id
     FROM hr_auth.user_accounts
     WHERE employee_id = $1 AND is_deleted = false
     LIMIT 1`,
    [employee.employee_id]
  );
  if (existingByEmployee.rowCount) {
    throw new AppError('An account already exists for this employee. Please login instead.', 409);
  }

  const username = normalizeEmail(employee.email);
  const existingByEmail = await client.query(
    `SELECT user_id
     FROM hr_auth.user_accounts
     WHERE lower(username) = $1 AND is_deleted = false
     LIMIT 1`,
    [username]
  );
  if (existingByEmail.rowCount) {
    throw new AppError('An account already exists for this email. Please login instead.', 409);
  }

  const roleIds = await seedCoreRoles(client);
  const passwordToHash = password || crypto.randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(passwordToHash, env.bcryptRounds);

  const created = await client.query(
    `INSERT INTO hr_auth.user_accounts (employee_id, username, password_hash)
     VALUES ($1, $2, $3)
     RETURNING user_id`,
    [employee.employee_id, username, passwordHash]
  );

  const userId = created.rows[0].user_id;
  const namesToAssign = validateRoleNames(roleNames);

  for (const roleName of namesToAssign) {
    const roleId = roleIds[roleName] || await ensureRole(roleName, client);
    await assignRole(userId, roleId, client);
  }

  return getUserProfile(userId, client);
};

const register = async ({ employee_id, username, password, role_names = [] }) => {
  if (!employee_id || !username || !password) {
    throw new AppError('employee_id, username and password are required', 400);
  }
  if (String(password).length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400);
  }
  const normalizedUsername = normalizeEmail(username);
  const roleNames = validateRoleNames(role_names);

  return db.withTransaction(async (client) => {
    const employee = await findEmployeeById(employee_id, client);
    ensureEmployeeCanUseAuth(employee);
    const existingEmployee = await client.query(
      'SELECT 1 FROM hr_auth.user_accounts WHERE employee_id = $1 AND is_deleted = false LIMIT 1',
      [employee.employee_id]
    );
    if (existingEmployee.rowCount) {
      throw new AppError('An account already exists for this employee', 409);
    }
    const existing = await client.query(
      'SELECT 1 FROM hr_auth.user_accounts WHERE lower(username) = $1 AND is_deleted = false LIMIT 1',
      [normalizedUsername]
    );
    if (existing.rowCount) {
      throw new AppError('Username already exists', 409);
    }

    const roleIds = await seedCoreRoles(client);
    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);

    const created = await client.query(
      `INSERT INTO hr_auth.user_accounts (employee_id, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING user_id`,
       [employee.employee_id, normalizedUsername, passwordHash]
    );

    const userId = created.rows[0].user_id;
    for (const roleName of roleNames) {
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

const bootstrapAdmin = async ({ email, password, bootstrapToken }) => {
  if (!tokensMatch(bootstrapToken, env.initialAdminToken)) {
    throw new AppError('Invalid bootstrap token', 403);
  }
  if (!email || !password) {
    throw new AppError('email and password are required', 400);
  }
  if (String(password).length < 12) {
    throw new AppError('Administrator password must be at least 12 characters long', 400);
  }

  return db.withTransaction(async (client) => {
    // Serialises bootstrap attempts, avoiding a first-user race condition.
    await client.query('SELECT pg_advisory_xact_lock(91827461)');
    if (await getUserCount(client) > 0) {
      throw new AppError('An administrator has already been bootstrapped', 409);
    }

    const employee = await findEmployeeByEmail(email, client);
    ensureEmployeeCanUseAuth(employee);
    const profile = await createAccountForEmployee({ employee, password, roleNames: ['Admin'] }, client);
    return { user: profile, token: signToken(profile) };
  });
};

const signupWithEmployeeEmail = async ({ email, password, role_names = [] }) => {
  if (!email || !password) {
    throw new AppError('email and password are required', 400);
  }

  if (String(password).length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400);
  }

  return db.withTransaction(async (client) => {
    if (await getUserCount(client) === 0) {
      throw new AppError('Bootstrap the first administrator before employee sign-up', 409);
    }
    const employee = await findEmployeeByEmail(email, client);
    ensureEmployeeCanUseAuth(employee);

    const profile = await createAccountForEmployee({
      employee,
      password,
      roleNames: role_names.length ? role_names : ['Employee']
    }, client);

    return {
      user: profile,
      token: signToken(profile)
    };
  });
};

// FIX 1: Query checks BOTH ua.username AND e.email so users can log in with
//         either their username or their employee email address.
// FIX 2: Always call bcrypt.compare — even when no user is found — so that
//         a missing account takes the same time as a wrong password, preventing
//         user-enumeration via response-timing attacks.
const login = async ({ username, email, password }) => {
  const loginId = normalizeEmail(email || username);
  if (!loginId || !password) {
    throw new AppError('email/username and password are required', 400);
  }

  const result = await db.query(
    `SELECT ua.user_id, ua.username, ua.password_hash, ua.is_active, e.employment_status
     FROM hr_auth.user_accounts ua
     LEFT JOIN org.employee e ON e.employee_id = ua.employee_id
     WHERE (lower(ua.username) = $1 OR lower(e.email) = $1)
       AND ua.is_deleted = false
     LIMIT 1`,
    [loginId]
  );

  const user = result.rows[0];

  // Always run bcrypt regardless of whether user exists (timing-safe)
  const hashToCheck = user ? user.password_hash : DUMMY_HASH;
  const passwordValid = await bcrypt.compare(password, hashToCheck);

  if (!user || !passwordValid) {
    throw new AppError('Invalid email/username or password', 401);
  }

  if (!user.is_active) {
    throw new AppError('Account is disabled', 403);
  }

  if (user.employment_status && user.employment_status !== 'Active') {
    throw new AppError(`Employee account is not active: ${user.employment_status}`, 403);
  }

  await db.query('UPDATE hr_auth.user_accounts SET last_login = now() WHERE user_id = $1', [user.user_id]);
  const profile = await getUserProfile(user.user_id);

  return {
    user: profile,
    token: signToken(profile)
  };
};

const verifyGoogleIdToken = async (idToken) => {
  if (!env.googleClientIds || env.googleClientIds.length === 0) {
    throw new AppError('Google auth is not configured. Set GOOGLE_CLIENT_ID in .env.', 503);
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.googleClientIds
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new AppError('Google account did not provide an email address', 401);
  }

  if (!payload.email_verified) {
    throw new AppError('Google email is not verified', 401);
  }

  return payload;
};

const loginWithGoogle = async ({ idToken }) => {
  if (!idToken) {
    throw new AppError('idToken is required', 400);
  }

  const googleUser = await verifyGoogleIdToken(idToken);
  const email = normalizeEmail(googleUser.email);

  return db.withTransaction(async (client) => {
    const employee = await findEmployeeByEmail(email, client);
    ensureEmployeeCanUseAuth(employee);

    const existing = await client.query(
      `SELECT user_id, is_active
       FROM hr_auth.user_accounts
       WHERE lower(username) = $1 AND is_deleted = false
       LIMIT 1`,
      [email]
    );

    let userId;
    if (existing.rowCount) {
      if (!existing.rows[0].is_active) {
        throw new AppError('Account is disabled', 403);
      }
      userId = existing.rows[0].user_id;
    } else {
      if (!env.googleAutoCreateAccounts) {
        throw new AppError('No account exists for this employee. Please sign up first.', 403);
      }

      const profile = await createAccountForEmployee({ employee }, client);
      userId = profile.user_id;
    }

    await client.query('UPDATE hr_auth.user_accounts SET last_login = now() WHERE user_id = $1', [userId]);
    const profile = await getUserProfile(userId, client);

    return {
      user: profile,
      token: signToken(profile),
      google: {
        email,
        name: googleUser.name || null,
        picture: googleUser.picture || null
      }
    };
  });
};

module.exports = {
  register,
  signupWithEmployeeEmail,
  login,
  loginWithGoogle,
  bootstrapAdmin,
  getUserProfile,
  getUserCount,
  seedCoreRoles,
  signToken
};
