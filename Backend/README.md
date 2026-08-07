# HR Operations Management System — Backend

> **Live API:** https://hr-operations-management-system.onrender.com  
> **Stack:** Node.js · Express · PostgreSQL · JWT · bcryptjs · Supabase

A RESTful backend that powers a full HR management platform covering 52 database tables across 8 schemas. The API is built around a schema-driven generic CRUD engine (no duplicate controllers per table) plus a dedicated workflow layer for business operations.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Schemas and Modules](#schemas-and-modules)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [Generic CRUD](#generic-crud)
  - [Workflow Endpoints](#workflow-endpoints)
- [Authentication and Authorization](#authentication-and-authorization)
- [Response Format](#response-format)
- [Error Codes](#error-codes)
- [Project Structure](#project-structure)
- [For Frontend Developers](#for-frontend-developers)

---

## Architecture Overview

```
src/
├── config/
│   ├── db.js           PostgreSQL pool + withTransaction helper
│   ├── env.js          Centralised env validation
│   └── resources.js    Parses schema SQL → resource metadata (lazy-loaded)
├── controllers/
│   ├── authController.js
│   ├── resourceController.js   Generic list / getOne / create / update / delete
│   └── workflowController.js   Business workflow actions
├── middleware/
│   ├── auth.js             JWT verification, authenticate(), requireAnyPermission()
│   ├── authorizeResource.js  Per-table permission check for CRUD routes
│   ├── errorHandler.js     Global error + 404 handler
│   └── rateLimiter.js      express-rate-limit (auth routes)
├── models/
│   └── ResourceModel.js    findAll (window fn) / findByPk / create / updateByPk / deleteByPk
├── routes/
│   ├── authRoutes.js
│   ├── resourceRoutes.js
│   └── workflowRoutes.js
├── services/
│   ├── authService.js      register / signup / login / loginWithGoogle
│   ├── auditService.js     writeAuditLog — structured failure logging
│   └── workflowService.js  All transactional business operations
└── utils/
    ├── AppError.js         Operational error with HTTP status
    ├── asyncHandler.js     Promise catch wrapper for Express
    └── queryUtils.js       SQL helpers (quoteIdent, pickWritable, getLimitOffset …)
```

**Key design decisions:**
- `resources.js` reads the schema SQL once and exposes metadata for every table. The generic CRUD controller works against any of the 52 tables without any per-table code.
- All state-changing workflows run inside `db.withTransaction`, so partial failures roll back automatically.
- `auditService.writeAuditLog` is called after every INSERT / UPDATE / DELETE and writes to `auth.audit_logs`. Failures are logged as `[AUDIT_FAILURE]` — never silently dropped.

---

## Schemas and Modules

| Schema | Module | Example tables |
|--------|--------|----------------|
| `org` | Organisation | employee, departments, offices, assets, grievances |
| `payroll` | Finance & Compensation | salary_contracts, payroll_runs, payslips, leave_requests, expense_claims |
| `recruitment` | Recruitment | vacancies, candidates, recruitment_results |
| `people` | Promotion | promotions, promotion_criteria_assessment, promotionapproval_log |
| `performance` | Performance | performance_plans, performance_goals, performance_review |
| `training` | Training | trainings, training_evaluations |
| `auth` | Security & Access | user_accounts, roles, role_permissions, audit_logs |
| `shared` | Cross-Module | documents |

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 or later |
| npm | 9 or later |
| PostgreSQL | 15 or later |
| Git | any recent |

---

## Local Setup

```bash
# 1. Clone
git clone https://github.com/Yosef-116/HR-Operations-Management-System.git
cd HR-Operations-Management-System/Backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum fill in DB_PASSWORD and JWT_SECRET

# 4. Create the database (PostgreSQL must be running)
createdb hr_operations

# 5. Run migrations — creates all schemas, tables, and seed data
npm run migrate

# 6. Verify the DB connection
npm run db:check

# 7. Start the dev server (auto-restarts on file changes)
npm run dev
# → Server running on http://localhost:5000
```

### Using Supabase instead of local PostgreSQL

Set `DATABASE_URL` to your Supabase connection string (Session pooler, port 5432) and leave `DB_*` variables empty. Set `DB_SSL=true`.

```env
DATABASE_URL=postgres://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
DB_SSL=true
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | HTTP port |
| `NODE_ENV` | No | `development` | `development` / `production` |
| `DATABASE_URL` | If no DB_* | — | Full connection string (overrides individual vars) |
| `DB_HOST` | No | `127.0.0.1` | PostgreSQL host |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `DB_NAME` | No | `hr_operations` | Database name |
| `DB_USER` | No | `postgres` | Database user |
| `DB_PASSWORD` | **Yes** | — | Database password |
| `DB_SSL` | No | `false` | Set `true` for Supabase / cloud DBs |
| `JWT_SECRET` | **Yes (prod)** | weak default | Min 32 random characters |
| `JWT_EXPIRES_IN` | No | `8h` | e.g. `1d`, `8h`, `30m` |
| `INITIAL_ADMIN_TOKEN` | **Yes (prod)** | — | One-time secret required to bootstrap the first Admin |
| `BCRYPT_ROUNDS` | No | `10` | Cost factor for password hashing |
| `GOOGLE_CLIENT_ID` | No | — | OAuth client ID for Google Sign-In |
| `GOOGLE_AUTO_CREATE_ACCOUNTS` | No | `true` | Auto-create HR account on first Google login |
| `CORS_ORIGIN` | No | `*` | Comma-separated allowed origins, or `*` |
| `AUTH_REQUIRED` | No | `true` | Set `false` only for local API exploration |
| `UPLOAD_DIR` | No | `uploads` | Directory for file uploads |

> **Production guard:** The server refuses to start if `JWT_SECRET` is the default placeholder or `AUTH_REQUIRED=false` when `NODE_ENV=production`.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with nodemon |
| `npm start` | Production server |
| `npm run migrate` | Run all schema migrations |
| `npm run db:check` | Verify DB connection and list schemas |
| `npm run db:ensure` | Create the database if it doesn't exist |
| `npm run test:smoke` | Quick smoke test against the running server |
| `npm run postman:generate` | Re-generate the Postman collection from routes |
| `npm run check` | Syntax check all JS files |

---

## API Reference

**Base URL:** `https://hr-operations-management-system.onrender.com/api/v1`  
**Local URL:** `http://localhost:5000/api/v1`

All endpoints except `/auth/bootstrap`, `/auth/login`, `/auth/signup`, `/auth/google`, and `/health` require a JWT:

```
Authorization: Bearer <token>
```

---

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/bootstrap` | Bootstrap token | Create the first administrator once |
| `POST` | `/auth/signup` | No | Register using an employee email already in the DB |
| `POST` | `/auth/register` | Admin | Provision an employee account with role assignment |
| `POST` | `/auth/login` | No | Login with email/username + password → JWT |
| `POST` | `/auth/google` | No | Login / auto-register via Google ID token |
| `GET` | `/auth/me` | Required | Return current user profile + roles + permissions |

> **Rate limited:** `/auth/login` and `/auth/google` — 20 requests per IP per 15 minutes.

**POST /auth/bootstrap**
```json
{
  "email": "admin@company.com",
  "password": "A-long-administrator-password",
  "bootstrap_token": "the-value-of-INITIAL_ADMIN_TOKEN"
}
```

This endpoint requires an active employee record, only works before any account exists, and creates an Admin account. Keep the bootstrap token in a secret store and rotate or remove it after setup.

**POST /auth/signup**
```json
// Request
{
  "email": "abebe.kebede@company.com",
  "password": "MySecurePass1!"
}

// Response 201
{
  "success": true,
  "data": {
    "user": { "user_id": 1, "username": "abebe.kebede@company.com", "roles": ["Employee"], "permissions": [...] },
    "token": "eyJ..."
  }
}
```

**POST /auth/login**
```json
// Accepts email or username in the "email" field
{ "email": "abebe.kebede@company.com", "password": "MySecurePass1!" }
// or
{ "username": "abebe.kebede@company.com", "password": "MySecurePass1!" }
```

**POST /auth/google**
```json
{ "idToken": "<Google OAuth ID token from frontend>" }
```

---

### Generic CRUD

Every one of the 52 tables is exposed through this single set of routes. The `schema` and `table` path parameters correspond directly to the PostgreSQL schema and table names.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/resources` | List all available tables grouped by schema |
| `GET` | `/data/:schema/:table` | List rows with pagination, search, sort |
| `GET` | `/data/:schema/:table/:id` | Get single row by primary key |
| `POST` | `/data/:schema/:table` | Insert a row |
| `PATCH` | `/data/:schema/:table/:id` | Update a row |
| `DELETE` | `/data/:schema/:table/:id` | Soft-delete (or `?hard=true` for permanent) |

**Query parameters for list:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Rows per page (max 500) |
| `page` | number | 1 | Page number |
| `offset` | number | — | Raw offset (overrides page) |
| `sort` | string | primary key | Column to sort by |
| `order` | `asc`/`desc` | `asc` | Sort direction |
| `search` | string | — | Case-insensitive ILIKE across all text/varchar columns |
| `includeDeleted` | boolean | `false` | Include soft-deleted rows |
| `[column]` | any | — | Filter by exact column value |

**Examples:**
```
GET /data/org/employee?limit=20&page=2&sort=hire_date&order=desc
GET /data/org/employee?search=Abebe&employment_status=Active
GET /data/payroll/payslips?run_id=5
```

---

### Workflow Endpoints

These handle multi-table transactional operations that go beyond simple CRUD.

#### Payroll

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `POST` | `/workflows/payroll/calculate` | `view_payroll` | Preview net pay calculation (no DB write) |
| `POST` | `/workflows/payroll/runs/:runId/generate-payslips` | `process_payroll` | Generate payslips for all active contracts |
| `POST` | `/workflows/payroll/runs/:runId/approve` | `process_payroll` | Set run status to Approved |
| `POST` | `/workflows/payroll/runs/:runId/process` | `manage_payroll` | Set run status to Processed (locks it) |

**POST /workflows/payroll/calculate** — no DB writes, safe to call repeatedly
```json
// Request
{ "gross_salary": 25000, "taxable_adjustments": 500, "non_taxable_adjustments": 200, "pensionRate": 0.07 }
// Response
{ "gross_salary": 25000, "taxable_income": 25500, "tax_amount": 4535, "pension_amount": 1750, "net_pay": 19415 }
```

#### Leave

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `POST` | `/workflows/leave-requests/:requestId/approve` | `approve_leave` | Approve a leave request |
| `POST` | `/workflows/leave-requests/:requestId/reject` | `approve_leave` | Reject a leave request |
| `GET` | `/workflows/employees/:employeeId/leave-balance` | `view_payroll` | Get remaining leave days |

**GET /workflows/employees/:employeeId/leave-balance?type_id=1&year=2024**
```json
{ "employee_id": 3, "type_id": 1, "year": 2024, "days_per_year": 20, "used_days": 5, "remaining_days": 15 }
```

#### Expense Claims

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `POST` | `/workflows/expense-claims/:claimId/approve` | `approve_expense` | Approve / reject / mark paid |

Body: `{ "status": "Approved" | "Rejected" | "Paid", "approver_id": 2 }`

#### Assets

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `POST` | `/workflows/assets/:assetId/assign` | `manage_org` | Assign an available asset to an employee |
| `POST` | `/workflows/asset-assignments/:assignmentId/return` | `manage_org` | Return an assigned asset |

#### Onboarding

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `POST` | `/workflows/onboarding/checklists` | `manage_org` | Create checklist + tasks for a new hire |
| `POST` | `/workflows/onboarding/tasks/:taskId/complete` | `manage_org` | Complete a task (auto-closes checklist when last task done) |

#### Recruitment

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `POST` | `/workflows/recruitment/candidates/:candidateId/hire` | `manage_recruitment` | Convert candidate → employee, update vacancy count |

#### Grievances

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `POST` | `/workflows/grievances/:grievanceId/resolve` | `resolve_grievance` | Resolve a grievance with notes |

#### Promotions

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `POST` | `/workflows/promotions/:promotionId/assess` | `approve_promotion` | Score a promotion (weighted formula) |
| `POST` | `/workflows/promotions/:promotionId/action` | `approve_promotion` | Approve / Reject / Return — updates job title and salary contract if Approved |

#### Performance

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `POST` | `/workflows/performance/goals/:goalId/evaluate` | `edit_performance` | Set actual value; auto-sets Achieved/Missed |
| `POST` | `/workflows/performance/plans/:planId/close` | `edit_performance` | Close plan and compute weighted overall rating |

#### Training

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `POST` | `/workflows/trainings/:trainingId/evaluate` | `manage_training` | Record score, certificate, and mark Completed |

#### Employee Exit

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `POST` | `/workflows/employees/:employeeId/exit` | `process_exit` | Record exit, update employment status, deactivate salary contract |

#### Documents

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `POST` | `/workflows/documents/upload` | `manage_shared` | Upload a file and link it to any entity (`multipart/form-data`) |

---

## Authentication and Authorization

### Token

The JWT payload contains:
```json
{
  "user_id": 1,
  "employee_id": 3,
  "email": "abebe@company.com",
  "username": "abebe@company.com",
  "roles": ["Admin"],
  "permissions": ["manage_org", "process_payroll", "..."]
}
```

Tokens expire after `JWT_EXPIRES_IN` (default 8 hours). Refresh by calling `POST /auth/login` again.

### Roles and Permissions

The first administrator must be created through the bootstrap endpoint with `INITIAL_ADMIN_TOKEN`. Employee signups get the **Employee** role by default; only Admins can assign other built-in roles.

Built-in roles: `Admin`, `HR Manager`, `Payroll Officer`, `Manager`, `Employee`

Admins have `manage_all` which bypasses all permission checks.

Permission names follow the pattern `{action}_{scope}`:

| Permission | Grants access to |
|-----------|-----------------|
| `manage_all` | Everything (Admin only) |
| `manage_org` | All org schema tables + asset/onboarding/exit workflows |
| `manage_payroll` | All payroll operations |
| `process_payroll` | Generate and approve payroll runs |
| `view_payroll` | Read payslips, leave balances |
| `approve_leave` | Approve/reject leave requests |
| `approve_expense` | Approve expense claims |
| `manage_recruitment` | Vacancies, candidates, hire workflow |
| `manage_people` | Promotions |
| `manage_performance` | Performance plans and goals |
| `manage_training` | Training records and evaluations |
| `resolve_grievance` | Resolve grievances |
| `process_exit` | Employee exit workflow |

For CRUD routes, the permission is derived from the action and schema: e.g. accessing `PATCH /data/org/employee` requires one of `edit_employee`, `edit_org`, `edit_org.employee`, or `manage_org`.

---

## Response Format

All endpoints return JSON in this envelope:

**Success**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 120, "limit": 50, "page": 1, "offset": 0 }
}
```
(`meta` is only present on list endpoints)

**Error**
```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad request — missing or invalid fields |
| 401 | Missing or invalid JWT |
| 403 | Valid JWT but insufficient permission, or account disabled |
| 404 | Record or route not found |
| 409 | Conflict — e.g. duplicate email, asset already assigned |
| 429 | Rate limit exceeded (auth endpoints) |
| 500 | Internal server error (stack trace included in development) |

---

## Project Structure

```
Backend/
├── Mysql/
│   └── hr_postgresql_schema.sql   Master schema — source of truth for all 52 tables
├── scripts/
│   ├── migrate.js                 Runs the schema SQL against the DB
│   ├── db-check.js                Verify connection + list schemas
│   ├── ensure-database.js         Create DB if missing
│   ├── generate-postman.js        Auto-generate Postman collection
│   └── smoke-test.js              Quick health + auth test
├── src/
│   └── ...                        (see Architecture Overview above)
├── uploads/                       File upload destination (gitignored)
├── .env.example                   Copy to .env and fill in secrets
└── package.json
```

---

## For Frontend Developers

### Base URL

```
Production:  https://hr-operations-management-system.onrender.com/api/v1
Development: http://localhost:5000/api/v1
```

### Authentication flow

1. Call `POST /auth/login` or `POST /auth/signup` → receive `data.token`
2. Store the token (memory or `sessionStorage` — avoid `localStorage` for sensitive apps)
3. Attach to every request: `Authorization: Bearer <token>`
4. On `401` response → token expired, redirect to login

### Decoding the token

The JWT payload is base64-decodable in the browser without a library:

```js
const decode = (token) => JSON.parse(atob(token.split('.')[1]));
const { roles, permissions, employee_id } = decode(token);
```

Use `permissions` to conditionally render UI elements (e.g. hide the payroll menu from non-payroll roles).

### Fetching a table (example)

```js
const res = await fetch('/api/v1/data/org/employee?limit=20&page=1&search=Abebe', {
  headers: { Authorization: `Bearer ${token}` }
});
const { data, meta } = await res.json();
// meta.total → total rows for pagination
```

### Creating a record (example)

```js
await fetch('/api/v1/data/org/employee', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ f_name: 'Abebe', l_name: 'Kebede', email: 'a@co.com', hire_date: '2024-01-01', employment_status: 'Active' })
});
```

### File upload (example)

```js
const form = new FormData();
form.append('file', fileInput.files[0]);
form.append('entity_type', 'employee');
form.append('entity_id', '3');

await fetch('/api/v1/workflows/documents/upload', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form
  // Do NOT set Content-Type — the browser sets it with the boundary
});
```

### Common gotchas

- **Soft deletes**: by default `DELETE` sets `is_deleted = true` and list endpoints hide deleted rows. Only Admins can pass `?hard=true` to permanently delete. Pass `?includeDeleted=true` to list deleted rows when authorized.
- **Pagination**: always check `meta.total` for the real count. Page size defaults to 50, maximum 500.
- **CORS**: in production set `CORS_ORIGIN` to your frontend domain on the server. The wildcard default is dev-only.
- **Rate limiting**: if you get `429` on login, wait 15 minutes or reduce retry logic.
- **Token expiry**: default is 8 hours. Show a re-login prompt on `401`.
