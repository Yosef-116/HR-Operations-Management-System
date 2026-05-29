# Postman Testing

Import these two files into Postman:

- `HR_Operations_API.postman_collection.json`
- `HR_Operations_Local.postman_environment.json`

Select the `HR Operations Local` environment before sending requests.

## Recommended Run Order

1. `00 Health & Auth / Health Check`
2. `00 Health & Auth / Register First Admin`
3. `00 Health & Auth / Login Bootstrap Admin`
4. `01 Metadata / List API Resources`
5. `02 Test Data Setup`
6. `11 Business Workflows`
7. Schema folders as needed

The login requests store `authToken` automatically. The setup requests store IDs such as `employeeId`, `officeId`, `assetId`, `leaveRequestId`, and `payrollRunId`, which the workflow requests reuse.

For normal users, set `employeeEmail` in the environment, run `02 Test Data Setup / Create Employee`, then run `00 Health & Auth / Signup With Employee Email`. For Google login, set `GOOGLE_CLIENT_ID` in `.env`, paste a Google ID token into the `googleIdToken` environment variable, and run `00 Health & Auth / Login With Google ID Token`.

## Folder Layout

- `03 Schema - org`: employees, offices, departments, attendance, assets, onboarding, grievances, exits
- `04 Schema - people`: promotions and approval workflow records
- `05 Schema - payroll`: payroll runs, payslips, salary contracts, tax brackets, leave, benefits, expenses
- `06 Schema - recruitment`: job titles, vacancies, candidates, recruitment results
- `07 Schema - performance`: plans, goals, reviews
- `08 Schema - training`: trainings and evaluations
- `09 Schema - auth`: users, roles, permissions, audit logs
- `10 Schema - shared`: documents
- `11 Business Workflows`: feature-level endpoints built on top of the schema tables

For document upload, open `11 Business Workflows / Documents / Upload Document` and choose any local file in the `file` form-data field before sending.
