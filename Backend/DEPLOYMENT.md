# Deployment Guide

## Required Environment Variables

Set these in your hosting provider:

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE
DB_SSL=true
JWT_SECRET=use-a-long-random-secret
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10
GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
GOOGLE_AUTO_CREATE_ACCOUNTS=true
CORS_ORIGIN=https://your-frontend-domain.com
AUTH_REQUIRED=true
UPLOAD_DIR=uploads
```

Use `DATABASE_URL` for hosted PostgreSQL. The separate `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` values are mainly for local development.

## Google Sign-In

Create a Google Cloud OAuth client with type `Web application`, then set its client ID in `GOOGLE_CLIENT_ID`. The backend expects the frontend or Postman to send a Google ID token to:

```text
POST /api/v1/auth/google
```

```json
{
  "idToken": "GOOGLE_ID_TOKEN"
}
```

The Google email must be verified and must already exist on an active `org.employee` record.

## Deploy Steps

```bash
npm ci
npm run db:check
npm run migrate
npm start
```

The migration command is safe to run more than once. It creates the schema the first time and always seeds the core roles/permissions.

## Postman Testing

Import both files:

- `postman/HR_Operations_API.postman_collection.json`
- `postman/HR_Operations_Local.postman_environment.json`

Run requests in this order:

1. `Health`
2. `Auth / Login`
3. `Metadata / List Resources`
4. `Office CRUD / Create Office`
5. `Office CRUD / Get Office`
6. `Office CRUD / Update Office`
7. `Workflows / Payroll Calculate`
8. `Office CRUD / Delete Office`

The local environment is already configured for `http://localhost:5000`.
