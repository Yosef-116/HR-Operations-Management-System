# 🏢 HR Operations Management System

A full-stack HR management platform built with **Node.js**, **Express**, and **PostgreSQL**. It covers the complete employee lifecycle — from recruitment and onboarding through payroll, performance, training, promotions, and exit — all accessible through a live web dashboard.

🔗 **Live Demo:** [hr-operations-management-system.onrender.com](https://hr-operations-management-system.onrender.com)

---

## Features

- **Authentication & Role-Based Access** — JWT login with five roles: Admin, HR Manager, Finance, Manager, and Employee. Each role sees only what they are permitted to access.
- **Employee Management** — Create, search, update, and soft-delete employee records with full profile details.
- **Payroll** — Create payroll runs, generate payslips with Ethiopian income tax brackets and pension calculations, then approve and process runs.
- **Leave Requests** — Submit, approve, reject, and track leave requests. Remaining balance is calculated per employee and leave type.
- **Expense Claims** — Submit expense claims and approve or reject them with a full approval log.
- **Recruitment** — Manage job vacancies and a candidate pipeline. Hiring a candidate automatically creates their employee record.
- **Performance** — Create performance plans with weighted goals, evaluate goal achievement, and close plans with a computed overall rating.
- **Training** — Schedule training programs, record evaluations, and issue certificates.
- **Promotions** — Initiate promotion requests, score candidates against weighted criteria, and approve or reject through a full approval log.
- **Asset Management** — Register company assets, assign them to employees, and track returns with condition notes.
- **Onboarding** — Create task checklists for new hires. The checklist automatically closes when the last task is completed.
- **Grievances** — File and resolve workplace grievances with resolution notes and a resolution date.
- **Employee Exit** — Process resignations and terminations, deactivate salary contracts, and record clearance status.
- **Audit Logs** — Every INSERT, UPDATE, and DELETE is automatically logged with the user, table, record ID, old value, new value, and timestamp.
- **Generic CRUD API** — All 52 database tables are exposed through a single schema-driven REST API with pagination, search, sort, and column filtering.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express.js |
| Database | PostgreSQL 15 (hosted on Supabase) |
| Authentication | JSON Web Tokens (jsonwebtoken) |
| Password hashing | bcryptjs |
| Frontend | React + TypeScript + Vite (incremental migration) |
| File uploads | Multer |
| Security | Helmet, express-rate-limit, CORS |
| Deployment | Render |

---

## Project Structure

```
HR-Operations-Management-System/
├── Backend/
│   ├── Mysql/
│   │   └── hr_postgresql_schema.sql   # Master schema — all 52 tables across 8 schemas
│   ├── public/
│   │   └── index.html                 # Legacy dashboard (retained during migration)
│   ├── scripts/
│   │   ├── migrate.js                 # Run schema SQL against the database
│   │   ├── db-check.js                # Verify DB connection and list schemas
│   │   └── smoke-test.js              # Quick health + auth smoke test
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                  # PostgreSQL pool and withTransaction helper
│   │   │   ├── env.js                 # Centralised environment variable config
│   │   │   ├── permissions.js         # Role definitions and permission lists
│   │   │   └── resources.js           # Schema-driven resource metadata loader
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── resourceController.js  # Generic list / getOne / create / update / delete
│   │   │   └── workflowController.js  # Business workflow actions
│   │   ├── middleware/
│   │   │   ├── auth.js                # JWT verification and permission checks
│   │   │   ├── authorizeResource.js   # Per-table permission enforcement
│   │   │   ├── errorHandler.js        # Global error and 404 handler
│   │   │   └── rateLimiter.js         # Auth endpoint rate limiting
│   │   ├── models/
│   │   │   └── ResourceModel.js       # Generic findAll / findByPk / create / update / delete
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── resourceRoutes.js
│   │   │   └── workflowRoutes.js
│   │   ├── services/
│   │   │   ├── authService.js         # Register, signup, login, Google OAuth
│   │   │   ├── auditService.js        # Audit log writer
│   │   │   └── workflowService.js     # All transactional business operations
│   │   ├── utils/
│   │   │   ├── AppError.js
│   │   │   ├── asyncHandler.js
│   │   │   └── queryUtils.js
│   │   ├── app.js                     # Express app setup
│   │   └── server.js                  # HTTP server entry point
│   ├── .env.example                   # Copy to .env and fill in your values
│   ├── package.json
│   ├── Dockerfile
│   └── README.md                      # Full backend and API reference
└── Frontend/
    ├── src/                           # React application source
    ├── package.json                   # React/Vite scripts and dependencies
    └── index_connected.html           # Legacy frontend backup
```

---

## Database Schema

The system uses 8 PostgreSQL schemas covering 52 tables:

| Schema | Module | Key tables |
|---|---|---|
| `org` | Organisation | employee, departments, offices, assets, grievances |
| `payroll` | Finance & Compensation | salary_contracts, payroll_runs, payslips, leave_requests, expense_claims |
| `recruitment` | Recruitment | vacancies, candidates, recruitment_results |
| `people` | Promotion | promotions, promotion_criteria_assessment |
| `performance` | Performance | performance_plans, performance_goals, performance_review |
| `training` | Training | trainings, training_evaluations |
| `hr_auth` | Security & Access | user_accounts, roles, role_permissions, audit_logs |
| `shared` | Cross-Module | documents |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- [PostgreSQL](https://www.postgresql.org/) 15 or later, or a [Supabase](https://supabase.com) project

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Yosef-116/HR-Operations-Management-System.git
   cd HR-Operations-Management-System/Backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in at minimum:
   ```
   DATABASE_URL=your_postgres_connection_string
   JWT_SECRET=a_long_random_secret_string
   DB_SSL=true
   ```

4. Run the database migration to create all schemas and tables:
   ```bash
   npm run migrate
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:5000`

### React frontend (development)

In a second terminal:

```bash
cd Frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` calls to the Express server on port 5000. The React migration currently includes authentication, dashboard, and employee management; remaining modules stay on the legacy dashboard until migrated and verified.

### Render deployment

The frontend must be built into `Backend/public`, the directory Express serves. The included [`render.yaml`](./render.yaml) uses this build command:

```bash
cd ../Frontend && npm ci --include=dev && npm run build && cd ../Backend && npm ci --omit=dev
```

For an existing Render service, set its **Root Directory** to `Backend` and copy that command into **Build Command**. Then redeploy the latest commit. The default `npm start` command starts Express, which will serve the generated React bundle.

---

## How It Works

1. The user logs in through the React frontend. It authenticates against `POST /api/v1/auth/login` and receives a JWT.
2. The JWT is stored in `sessionStorage` and attached to every subsequent request as a `Bearer` token.
3. The token payload contains the user's roles and permissions. The frontend uses these to show or hide UI elements.
4. Data is fetched through the generic CRUD API (`/api/v1/data/:schema/:table`) with support for pagination, search, sort, and column filters.
5. Business operations (generating payslips, approving leave, hiring a candidate) go through dedicated workflow endpoints (`/api/v1/workflows/...`) which run inside database transactions and write to the audit log.
6. The Express server also serves the frontend `index.html` from the `public/` folder, so the frontend and backend share one deployed URL.

---

## API Overview

**Base URL:** `https://hr-operations-management-system.onrender.com/api/v1`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/signup` | Register using an employee email already in the system |
| `POST` | `/auth/bootstrap` | Bootstrap the first administrator with `INITIAL_ADMIN_TOKEN` |
| `POST` | `/auth/login` | Login and receive a JWT |
| `GET` | `/auth/me` | Get current user profile and permissions |
| `GET` | `/resources` | List all 52 available tables |
| `GET` | `/data/:schema/:table` | List rows with pagination, search, and filters |
| `POST` | `/data/:schema/:table` | Insert a record |
| `PATCH` | `/data/:schema/:table/:id` | Update a record |
| `DELETE` | `/data/:schema/:table/:id` | Soft-delete a record |
| `POST` | `/workflows/payroll/runs/:id/generate-payslips` | Generate payslips for a payroll run |
| `POST` | `/workflows/leave-requests/:id/approve` | Approve a leave request |
| `POST` | `/workflows/expense-claims/:id/approve` | Approve or reject an expense claim |
| `POST` | `/workflows/recruitment/candidates/:id/hire` | Convert a candidate to an employee |
| `POST` | `/workflows/employees/:id/exit` | Process an employee exit |
| `POST` | `/workflows/performance/plans/:id/close` | Close a plan and compute the overall rating |

For the full API reference see [`Backend/README.md`](./Backend/README.md).

---

## Deployment

The app is deployed on **[Render](https://render.com)**. The `start` script (`node src/server.js`) is used as the run command. Environment variables are configured in the Render dashboard. The database is hosted on **[Supabase](https://supabase.com)**.

---

