# HR Operations Management Backend

Node.js MVC backend for the HR and Operations Management System database. The API is built around the PostgreSQL schema in `Mysql/hr_postgresql_schema.sql` and exposes both generic CRUD endpoints for all 52 normalized tables and workflow endpoints for the business features described in the database document.

## Stack

- Express.js
- PostgreSQL via `pg`
- JWT authentication
- Role-based permissions
- Bcrypt password hashing
- Multer document uploads

## Setup

```bash
npm install
copy .env.example .env
npm run db:ensure
npm run migrate
npm run dev
```

Update `.env` with either `DATABASE_URL` or the separate local `DB_*` values before running the migration. This project is configured locally for PostgreSQL on port `55432`.

`npm run dev` checks PostgreSQL before opening the API port. If the database is down or `.env` is wrong, the server exits and prints the connection target it tried.

The first registered account becomes `Admin` automatically. Later accounts default to the `Employee` role unless an Admin assigns roles.

## Project Structure

```text
src/
  config/       environment, database, schema metadata, permissions
  controllers/  HTTP request handlers
  middleware/   auth, authorization, and errors
  models/       reusable PostgreSQL data access
  routes/       API route definitions
  services/     business workflow logic
  utils/        shared helpers
scripts/        migration and syntax check scripts
uploads/        local document uploads
```

## Core Endpoints

- `GET /health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/google`
- `GET /api/v1/auth/me`
- `GET /api/v1/resources`
- `GET /api/v1/data/:schema/:table`
- `POST /api/v1/data/:schema/:table`
- `GET /api/v1/data/:schema/:table/:id`
- `PATCH /api/v1/data/:schema/:table/:id`
- `DELETE /api/v1/data/:schema/:table/:id`

Composite-key tables can be updated or deleted by passing primary-key fields in the query string or in a `where` object in the JSON body.

## Authentication

Use `POST /api/v1/auth/signup` for normal users. The submitted `email` must already exist in `org.employee.email`, and the employee must have `employment_status = 'Active'`. The created auth username becomes the employee email, so `POST /api/v1/auth/login` accepts either `{ "email": "...", "password": "..." }` or the older `{ "username": "...", "password": "..." }` format.

Google login uses `POST /api/v1/auth/google` with a Google ID token:

```json
{
  "idToken": "GOOGLE_ID_TOKEN_FROM_FRONTEND"
}
```

Set `GOOGLE_CLIENT_ID` in `.env` to the Web application OAuth client ID from Google Cloud. The Google email must be verified and must match an existing active employee email.

## Workflow Endpoints

- Payroll: calculate pay, generate payslips, approve/process payroll runs
- Leave: approve/reject requests and calculate leave balance
- Expenses: approve/reject/pay claims
- Assets: assign and return assets
- Onboarding: create checklists and complete tasks
- Offboarding: create employee exits and close active salary contracts
- Recruitment: hire candidates into employees
- Promotions: assess and approve/reject/return promotions
- Performance: evaluate goals and close plans
- Training: record training evaluations
- Grievances: resolve complaints
- Documents: upload and register polymorphic documents

All mutating endpoints write to `auth.audit_logs` when the schema is already migrated.

## Checks

```bash
npm run db:check
npm run check
npm run test:smoke
```

Postman files are in `postman/`. Run `npm run postman:generate` whenever the schema changes. Deployment notes are in `DEPLOYMENT.md`.
