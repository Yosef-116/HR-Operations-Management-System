const fs = require('fs');
const path = require('path');
const { resourceList } = require('../src/config/resources');

const postmanDir = path.resolve(process.cwd(), 'postman');
const collectionPath = path.join(postmanDir, 'HR_Operations_API.postman_collection.json');
const environmentPath = path.join(postmanDir, 'HR_Operations_Local.postman_environment.json');

const schemaOrder = ['org', 'people', 'payroll', 'recruitment', 'performance', 'training', 'auth', 'shared'];

const schemaLabels = {
  org: 'Organisation',
  people: 'Promotion',
  payroll: 'Finance & Compensation',
  recruitment: 'Recruitment',
  performance: 'Performance',
  training: 'Training',
  auth: 'Security & Access',
  shared: 'Documents'
};

const pkVarOverrides = {
  'org.departments.dept_id': 'deptId',
  'org.employee_shifts.employee_id': 'employeeId',
  'org.employee_shifts.shift_id': 'shiftId',
  'payroll.tax_brackets_eth.bracket_id': 'taxBracketId',
  'payroll.salary_matrix.matrix_id': 'matrixId',
  'payroll.leave_types.type_id': 'leaveTypeId',
  'payroll.leave_entitlements.type_id': 'leaveTypeId',
  'payroll.leave_entitlements.job_id': 'jobId',
  'payroll.leave_requests.request_id': 'leaveRequestId',
  'payroll.expense_claims.claim_id': 'claimId',
  'payroll.benefit_plans.plan_id': 'benefitPlanId',
  'payroll.employee_benefits.enrollment_id': 'benefitEnrollmentId',
  'performance.performance_plans.plan_id': 'performancePlanId',
  'performance.performance_goals.goal_id': 'performanceGoalId',
  'training.training_evaluations.eval_id': 'trainingEvaluationId',
  'shared.documents.document_id': 'documentId'
};

const columnVarOverrides = {
  employee_id: 'employeeId',
  created_by: 'employeeId',
  completed_by: 'employeeId',
  approved_by: 'employeeId',
  issued_by: 'employeeId',
  resolved_by: 'employeeId',
  assessed_by: 'employeeId',
  approver_id: 'employeeId',
  run_by: 'employeeId',
  reviewer_id: 'employeeId',
  evaluated_by: 'employeeId',
  uploaded_by: 'employeeId',
  manager_id: 'employeeId',
  office_id: 'officeId',
  dept_id: 'deptId',
  department_id: 'deptId',
  job_id: 'jobId',
  old_job_id: 'jobId',
  new_job_id: 'newJobId',
  shift_id: 'shiftId',
  asset_id: 'assetId',
  assignment_id: 'assetAssignmentId',
  checklist_id: 'checklistId',
  task_id: 'taskId',
  promotion_id: 'promotionId',
  old_matrix_id: 'matrixId',
  new_matrix_id: 'newMatrixId',
  matrix_id: 'matrixId',
  run_id: 'payrollRunId',
  payslip_id: 'payslipId',
  type_id: 'leaveTypeId',
  claim_id: 'claimId',
  plan_id: 'performancePlanId',
  candidate_id: 'candidateId',
  vacancy_id: 'vacancyId',
  training_id: 'trainingId',
  role_id: 'roleId',
  user_id: 'userId',
  plan_id_payroll: 'benefitPlanId',
  entity_id: 'employeeId'
};

const environmentVariables = new Set([
  'baseUrl',
  'adminUsername',
  'adminPassword',
  'authToken',
  'officeId',
  'deptId',
  'jobId',
  'newJobId',
  'employeeId',
  'shiftId',
  'assetId',
  'assetAssignmentId',
  'checklistId',
  'taskId',
  'grievanceId',
  'promotionId',
  'assessmentId',
  'promotionApprovalLogId',
  'taxBracketId',
  'matrixId',
  'newMatrixId',
  'salaryContractId',
  'payrollRunId',
  'payslipId',
  'deductionId',
  'adjustmentId',
  'leaveTypeId',
  'leaveRequestId',
  'claimId',
  'claimApprovalId',
  'benefitPlanId',
  'benefitEnrollmentId',
  'vacancyId',
  'candidateId',
  'recruitmentResultId',
  'candidatePhoneId',
  'performancePlanId',
  'performanceGoalId',
  'performanceReviewId',
  'trainingId',
  'trainingEvaluationId',
  'userId',
  'roleId',
  'permissionId',
  'auditLogId',
  'documentId'
]);

const asTitle = (value) => value
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const camel = (value) => value.replace(/_([a-z])/g, (_, char) => char.toUpperCase());

const pkVariable = (resource, pkColumn) => {
  const override = pkVarOverrides[`${resource.key}.${pkColumn}`];
  if (override) return override;
  if (pkColumn.endsWith('_id')) return camel(pkColumn);
  return `${camel(pkColumn)}Value`;
};

const variableForColumn = (resource, columnName) => {
  const resourceSpecific = pkVarOverrides[`${resource.key}.${columnName}`];
  if (resourceSpecific) return resourceSpecific;
  if (resource.key === 'payroll.employee_benefits' && columnName === 'plan_id') return 'benefitPlanId';
  if (resource.key === 'performance.performance_review' && columnName === 'plan_id') return 'performancePlanId';
  return columnVarOverrides[columnName];
};

const sampleValue = (resource, column) => {
  const name = column.name;
  const variable = variableForColumn(resource, name);
  if (variable) return `{{${variable}}}`;

  if (name === 'username') return 'postman_user_{{$timestamp}}';
  if (name === 'password_hash') return 'use-auth-register-not-direct-crud';
  if (name === 'role_name') return 'Postman_Role_{{$timestamp}}';
  if (name === 'permission_name') return `manage_${resource.schema}`;
  if (name === 'email') return 'postman+{{$timestamp}}@example.com';
  if (name === 'serial_number') return 'ASSET-{{$timestamp}}';
  if (name === 'national_id') return 'NID-{{$timestamp}}';
  if (name === 'phone' || name === 'phone_number') return '+251911000000';
  if (name === 'f_name') return 'Postman';
  if (name === 'l_name') return 'Tester';
  if (name === 'full_name') return 'Postman Tester';
  if (name.includes('status')) return statusFor(resource);
  if (name === 'gender') return 'Other';
  if (name === 'nationality') return 'Ethiopian';
  if (name === 'relationship') return 'Sibling';
  if (name === 'location_type') return 'On_site';
  if (name === 'condition') return 'Good';
  if (name === 'condition_on_return') return 'Good';
  if (name === 'asset_type') return 'Laptop';
  if (name === 'asset_name') return 'Postman Laptop';
  if (name === 'dept_name') return 'Postman Department';
  if (name === 'location_name') return 'Postman Office';
  if (name === 'city') return 'Addis Ababa';
  if (name === 'addresses') return 'Postman test address';
  if (name === 'shift_name') return 'Morning';
  if (name === 'task_name') return 'Submit national ID';
  if (name === 'exit_type') return 'Resignation';
  if (name === 'clearance_status') return 'Pending';
  if (name === 'category') return 'Other';
  if (name === 'action_type') return 'Written_Warning';
  if (name === 'appeal_status') return 'None';
  if (name === 'action') return 'Approved';
  if (name === 'level') return 'L1';
  if (name === 'contract_type') return 'Permanent';
  if (name === 'adjustment_type') return 'Bonus';
  if (name === 'payment_status') return 'Pending';
  if (name === 'type_name') return 'Loan';
  if (name === 'name') return 'Annual Leave';
  if (name === 'plan_name') return 'Health Benefit';
  if (name === 'plan_type') return 'Health';
  if (name === 'provider') return 'Postman Provider';
  if (name === 'title_name') return 'HR Officer';
  if (name === 'exam_type') return 'Written';
  if (name === 'type') return 'Full_Time';
  if (name === 'source') return 'Referral';
  if (name === 'goal_title') return 'Improve HR operations';
  if (name === 'approval_status') return 'Pending';
  if (name === 'entity_type') return 'Employee';
  if (name === 'file_name') return 'postman-document.pdf';
  if (name === 'file_path') return 'uploads/postman-document.pdf';
  if (name === 'file_type') return 'PDF';

  if (/(description|reason|notes|comments|letter|path)/i.test(name)) return 'Created from Postman test collection';
  if (/(date|day)/i.test(name)) return '2026-06-01';
  if (/time/i.test(column.type) || /time/i.test(name)) return '09:00:00';
  if (/bool/i.test(column.type) || name.startsWith('is_') || name.startsWith('can_')) return true;
  if (/(decimal|numeric|money)/i.test(column.type)) return 1000;
  if (/(integer|smallint|serial)/i.test(column.type)) return 1;
  return `Postman ${asTitle(name)}`;
};

const statusFor = (resource) => {
  const map = {
    'org.employee': 'Active',
    'org.attendance': 'Present',
    'org.overtime_records': 'Pending',
    'org.onboarding_checklists': 'In_Progress',
    'org.onboarding_tasks': 'Pending',
    'org.grievances': 'Open',
    'org.assets': 'Available',
    'people.promotions': 'Pending',
    'payroll.payroll_runs': 'Draft',
    'payroll.payroll_adjustments': 'Pending',
    'payroll.leave_requests': 'Pending',
    'payroll.expense_claims': 'Submitted',
    'recruitment.vacancies': 'Open',
    'recruitment.recruitment_results': 'Shortlisted',
    'performance.performance_plans': 'Open',
    'performance.performance_goals': 'Pending',
    'training.trainings': 'Scheduled'
  };
  return map[resource.key] || 'Pending';
};

const isWritable = (resource, column, mode = 'create') => {
  if (column.isGenerated) return false;
  if (['created_at', 'updated_at', 'deleted_at', 'is_deleted', 'last_login', 'timestamp'].includes(column.name)) return false;
  if (mode === 'create') return !(resource.primaryKey.includes(column.name) && column.isSerial);
  return !resource.primaryKey.includes(column.name);
};

const createBody = (resource) => {
  const body = {};
  for (const column of resource.columns) {
    if (!isWritable(resource, column, 'create')) continue;
    if (resource.primaryKey.includes(column.name) || !column.nullable || column.name.endsWith('_id')) {
      body[column.name] = sampleValue(resource, column);
    }
  }
  return body;
};

const updateBody = (resource) => {
  const column = resource.columns.find((candidate) => (
    isWritable(resource, candidate, 'update') &&
    !candidate.name.endsWith('_id') &&
    !/(date|time|bool|decimal|numeric|integer|serial)/i.test(candidate.type)
  )) || resource.columns.find((candidate) => isWritable(resource, candidate, 'update'));

  if (!column) return {};
  return { [column.name]: sampleValue(resource, column) };
};

const jsonBody = (body) => ({
  mode: 'raw',
  raw: JSON.stringify(body, null, 2),
  options: {
    raw: {
      language: 'json'
    }
  }
});

const headers = () => [{ key: 'Content-Type', value: 'application/json' }];

const request = ({ name, method, url, body, auth, events, description, headers: customHeaders }) => ({
  name,
  ...(description ? { description } : {}),
  request: {
    ...(auth ? { auth } : {}),
    method,
    header: customHeaders || (body ? headers() : []),
    ...(body ? { body: jsonBody(body) } : {}),
    url
  },
  ...(events ? { event: events } : {})
});

const formRequest = ({ name, method, url, formdata, events, description }) => ({
  name,
  ...(description ? { description } : {}),
  request: {
    method,
    header: [],
    body: {
      mode: 'formdata',
      formdata
    },
    url
  },
  ...(events ? { event: events } : {})
});

const testEvent = (lines) => [{
  listen: 'test',
  script: {
    type: 'text/javascript',
    exec: lines
  }
}];

const savePathEvent = (variableName, pathExpression, acceptedCodes = [200, 201]) => testEvent([
  `pm.test('status is ${acceptedCodes.join(' or ')}', function () {`,
  `  pm.expect([${acceptedCodes.join(', ')}]).to.include(pm.response.code);`,
  '});',
  'const json = pm.response.json();',
  'const readPath = (source, path) => path.split(\'.\').reduce((value, key) => {',
  '  if (value === undefined || value === null) return undefined;',
  '  return Array.isArray(value) ? value[Number(key)] : value[key];',
  '}, source);',
  `const value = readPath(json, '${pathExpression}');`,
  'if (value !== undefined && value !== null) {',
  `  pm.environment.set('${variableName}', value);`,
  '}'
]);

const basicSuccessEvent = (acceptedCodes = [200]) => testEvent([
  `pm.test('status is ${acceptedCodes.join(' or ')}', function () {`,
  `  pm.expect([${acceptedCodes.join(', ')}]).to.include(pm.response.code);`,
  '});',
  'pm.test(\'response has success=true\', function () {',
  '  pm.expect(pm.response.json().success).to.eql(true);',
  '});'
]);

const urlFor = (pathName) => `{{baseUrl}}${pathName}`;

const tableRequests = (resource) => {
  const pkVars = resource.primaryKey.map((pk) => pkVariable(resource, pk));
  pkVars.forEach((variable) => environmentVariables.add(variable));

  const singlePk = resource.primaryKey.length === 1;
  const pkPath = singlePk ? `{{${pkVars[0]}}}` : '';
  const query = resource.primaryKey.map((pk, index) => `${pk}={{${pkVars[index]}}}`).join('&');
  const createAllowed = !['auth.user_accounts', 'auth.audit_logs'].includes(resource.key);
  const updateAllowed = resource.key !== 'auth.audit_logs';

  const items = [
    request({
      name: `List ${asTitle(resource.table)}`,
      method: 'GET',
      url: urlFor(`/api/v1/data/${resource.schema}/${resource.table}?limit=20`),
      events: basicSuccessEvent()
    })
  ];

  if (createAllowed) {
    items.push(request({
      name: `Create ${asTitle(resource.table)}`,
      method: 'POST',
      url: urlFor(`/api/v1/data/${resource.schema}/${resource.table}`),
      body: createBody(resource),
      events: singlePk ? savePathEvent(pkVars[0], `data.${resource.primaryKey[0]}`, [201]) : basicSuccessEvent([201]),
      description: 'For foreign-key fields, run the Test Data Setup folder first or replace the variables with existing IDs.'
    }));
  }

  if (singlePk) {
    items.push(request({
      name: `Get ${asTitle(resource.table)} By ID`,
      method: 'GET',
      url: urlFor(`/api/v1/data/${resource.schema}/${resource.table}/${pkPath}`),
      events: basicSuccessEvent()
    }));
  } else {
    items.push(request({
      name: `Filter ${asTitle(resource.table)} By Composite Key`,
      method: 'GET',
      url: urlFor(`/api/v1/data/${resource.schema}/${resource.table}?${query}`),
      events: basicSuccessEvent()
    }));
  }

  if (updateAllowed) {
    const body = singlePk ? updateBody(resource) : { where: Object.fromEntries(resource.primaryKey.map((pk, index) => [pk, `{{${pkVars[index]}}}`])), ...updateBody(resource) };
    items.push(request({
      name: `Update ${asTitle(resource.table)}`,
      method: 'PATCH',
      url: singlePk
        ? urlFor(`/api/v1/data/${resource.schema}/${resource.table}/${pkPath}`)
        : urlFor(`/api/v1/data/${resource.schema}/${resource.table}`),
      body,
      events: basicSuccessEvent()
    }));
  }

  if (updateAllowed) {
    items.push(request({
      name: `Delete ${asTitle(resource.table)}`,
      method: 'DELETE',
      url: singlePk
        ? urlFor(`/api/v1/data/${resource.schema}/${resource.table}/${pkPath}`)
        : urlFor(`/api/v1/data/${resource.schema}/${resource.table}?${query}`),
      events: basicSuccessEvent()
    }));
  }

  return {
    name: `${asTitle(resource.table)} (${resource.key})`,
    description: `Generic CRUD endpoints for ${resource.key}. Primary key: ${resource.primaryKey.join(', ') || 'none'}.`,
    item: items
  };
};

const createTableRequest = ({ name, resourceKey, variable, body }) => {
  const resource = resourceList.find((item) => item.key === resourceKey);
  return request({
    name,
    method: 'POST',
    url: urlFor(`/api/v1/data/${resource.schema}/${resource.table}`),
    body,
    events: variable ? savePathEvent(variable, `data.${resource.primaryKey[0]}`, [201]) : basicSuccessEvent([201])
  });
};

const setupFolder = () => ({
  name: '02 Test Data Setup',
  description: 'Run these requests after Login when you want realistic IDs for workflow testing.',
  item: [
    createTableRequest({
      name: 'Create Office',
      resourceKey: 'org.offices',
      variable: 'officeId',
      body: { location_name: 'Postman HQ {{$timestamp}}', city: 'Addis Ababa', addresses: 'Bole Road' }
    }),
    createTableRequest({
      name: 'Create Department',
      resourceKey: 'org.departments',
      variable: 'deptId',
      body: { dept_name: 'People Operations {{$timestamp}}', office_id: '{{officeId}}' }
    }),
    createTableRequest({
      name: 'Create Job Title',
      resourceKey: 'recruitment.job_titles',
      variable: 'jobId',
      body: { title_name: 'HR Officer {{$timestamp}}', exam_type: 'Written', job_row: 1 }
    }),
    createTableRequest({
      name: 'Create Employee',
      resourceKey: 'org.employee',
      variable: 'employeeId',
      body: {
        f_name: 'Postman',
        l_name: 'Employee',
        email: 'employee+{{$timestamp}}@example.com',
        gender: 'Other',
        birth_date: '1996-01-01',
        national_id: 'NID-{{$timestamp}}',
        nationality: 'Ethiopian',
        hire_date: '2026-06-01',
        employment_status: 'Active',
        dept_id: '{{deptId}}',
        job_id: '{{jobId}}',
        office_id: '{{officeId}}'
      }
    }),
    createTableRequest({
      name: 'Create Asset',
      resourceKey: 'org.assets',
      variable: 'assetId',
      body: {
        asset_name: 'Postman Laptop {{$timestamp}}',
        asset_type: 'Laptop',
        serial_number: 'PM-ASSET-{{$timestamp}}',
        purchase_date: '2026-06-01',
        condition: 'Good',
        status: 'Available'
      }
    }),
    createTableRequest({
      name: 'Create Grievance',
      resourceKey: 'org.grievances',
      variable: 'grievanceId',
      body: {
        employee_id: '{{employeeId}}',
        submitted_date: '2026-06-05',
        category: 'Other',
        description: 'Postman grievance test',
        status: 'Open'
      }
    }),
    createTableRequest({
      name: 'Create Salary Matrix',
      resourceKey: 'payroll.salary_matrix',
      variable: 'matrixId',
      body: { level: 'L1', step: 1, base_salary: 15000 }
    }),
    createTableRequest({
      name: 'Create Tax Bracket',
      resourceKey: 'payroll.tax_brackets_eth',
      variable: 'taxBracketId',
      body: { min_income: 0, max_income: 999999, tax_rate: 0.1, deductible_fee: 0 }
    }),
    createTableRequest({
      name: 'Create Salary Contract',
      resourceKey: 'payroll.salary_contracts',
      variable: 'salaryContractId',
      body: {
        employee_id: '{{employeeId}}',
        matrix_id: '{{matrixId}}',
        contract_type: 'Permanent',
        start_date: '2026-06-01',
        is_active: true,
        approved_by: '{{employeeId}}',
        signed_date: '2026-06-01'
      }
    }),
    createTableRequest({
      name: 'Create Payroll Run',
      resourceKey: 'payroll.payroll_runs',
      variable: 'payrollRunId',
      body: { run_date: '2026-06-30', status: 'Draft', run_by: '{{employeeId}}' }
    }),
    createTableRequest({
      name: 'Create Leave Type',
      resourceKey: 'payroll.leave_types',
      variable: 'leaveTypeId',
      body: { name: 'Annual Leave {{$timestamp}}', is_paid: true }
    }),
    createTableRequest({
      name: 'Create Leave Entitlement',
      resourceKey: 'payroll.leave_entitlements',
      body: {
        type_id: '{{leaveTypeId}}',
        job_id: '{{jobId}}',
        days_per_year: 20,
        accrual_rate_monthly: 1.67,
        can_carry_over: true
      }
    }),
    createTableRequest({
      name: 'Create Leave Request',
      resourceKey: 'payroll.leave_requests',
      variable: 'leaveRequestId',
      body: {
        employee_id: '{{employeeId}}',
        type_id: '{{leaveTypeId}}',
        start_date: '2026-07-01',
        end_date: '2026-07-03',
        status: 'Pending'
      }
    }),
    createTableRequest({
      name: 'Create Expense Claim',
      resourceKey: 'payroll.expense_claims',
      variable: 'claimId',
      body: {
        employee_id: '{{employeeId}}',
        amount: 1250,
        category: 'Transport',
        description: 'Postman expense claim',
        receipt_path: 'uploads/receipt.pdf',
        status: 'Submitted',
        submitted_date: '2026-06-10'
      }
    }),
    createTableRequest({
      name: 'Create Vacancy',
      resourceKey: 'recruitment.vacancies',
      variable: 'vacancyId',
      body: {
        job_id: '{{jobId}}',
        status: 'Open',
        type: 'Full_Time',
        no_of_positions: 1,
        posted_date: '2026-06-01',
        closing_date: '2026-07-01',
        description: 'Postman vacancy'
      }
    }),
    createTableRequest({
      name: 'Create Candidate',
      resourceKey: 'recruitment.candidates',
      variable: 'candidateId',
      body: {
        f_name: 'Postman',
        l_name: 'Candidate',
        email: 'candidate+{{$timestamp}}@example.com',
        vacancy_id: '{{vacancyId}}',
        source: 'Referral',
        application_date: '2026-06-02'
      }
    }),
    createTableRequest({
      name: 'Create Promotion',
      resourceKey: 'people.promotions',
      variable: 'promotionId',
      body: {
        employee_id: '{{employeeId}}',
        old_job_id: '{{jobId}}',
        new_job_id: '{{jobId}}',
        old_matrix_id: '{{matrixId}}',
        new_matrix_id: '{{matrixId}}',
        promotion_date: '2026-08-01',
        effective_date: '2026-09-01',
        reason: 'Postman promotion test',
        status: 'Pending'
      }
    }),
    createTableRequest({
      name: 'Create Performance Plan',
      resourceKey: 'performance.performance_plans',
      variable: 'performancePlanId',
      body: {
        employee_id: '{{employeeId}}',
        year: 2026,
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        plan_status: 'Open',
        created_by: '{{employeeId}}'
      }
    }),
    createTableRequest({
      name: 'Create Performance Goal',
      resourceKey: 'performance.performance_goals',
      variable: 'performanceGoalId',
      body: {
        plan_id: '{{performancePlanId}}',
        goal_title: 'Improve HR workflow turnaround',
        description: 'Postman performance goal',
        target_value: 100,
        actual_value: 0,
        weight: 50,
        status: 'Pending'
      }
    }),
    createTableRequest({
      name: 'Create Training',
      resourceKey: 'training.trainings',
      variable: 'trainingId',
      body: {
        employee_id: '{{employeeId}}',
        title: 'Postman Compliance Training',
        type: 'Compliance',
        provider: 'Internal HR',
        start_date: '2026-06-01',
        end_date: '2026-06-05',
        cost: 1000,
        location: 'Addis Ababa',
        status: 'Scheduled'
      }
    })
  ]
});

const authFolder = () => ({
  name: '00 Health & Auth',
  item: [
    request({
      name: 'Health Check',
      method: 'GET',
      url: urlFor('/health'),
      auth: { type: 'noauth' },
      events: basicSuccessEvent()
    }),
    request({
      name: 'Register First Admin',
      method: 'POST',
      url: urlFor('/api/v1/auth/register'),
      auth: { type: 'noauth' },
      body: { username: '{{adminUsername}}', password: '{{adminPassword}}' },
      events: testEvent([
        "pm.test('registered or already exists', function () {",
        '  pm.expect([201, 409]).to.include(pm.response.code);',
        '});',
        'if (pm.response.code === 201) {',
        '  const json = pm.response.json();',
        "  pm.environment.set('authToken', json.data.token);",
        "  pm.environment.set('userId', json.data.user.user_id);",
        '}'
      ]),
      description: 'Run this only on a fresh database. If the admin already exists, run Login next.'
    }),
    request({
      name: 'Login',
      method: 'POST',
      url: urlFor('/api/v1/auth/login'),
      auth: { type: 'noauth' },
      body: { username: '{{adminUsername}}', password: '{{adminPassword}}' },
      events: testEvent([
        "pm.test('login succeeded', function () { pm.response.to.have.status(200); });",
        'const json = pm.response.json();',
        "pm.environment.set('authToken', json.data.token);",
        "pm.environment.set('userId', json.data.user.user_id);",
        "if (json.data.user.employee_id) pm.environment.set('employeeId', json.data.user.employee_id);"
      ])
    }),
    request({
      name: 'Current User',
      method: 'GET',
      url: urlFor('/api/v1/auth/me'),
      events: basicSuccessEvent()
    })
  ]
});

const metadataFolder = () => ({
  name: '01 Metadata',
  item: [
    request({
      name: 'List API Resources',
      method: 'GET',
      url: urlFor('/api/v1/resources'),
      events: testEvent([
        "pm.test('request succeeded', function () { pm.response.to.have.status(200); });",
        "pm.test('52 tables exposed', function () { pm.expect(pm.response.json().meta.tableCount).to.eql(52); });"
      ])
    })
  ]
});

const workflowFolders = () => ({
  name: '11 Business Workflows',
  description: 'Run 02 Test Data Setup first for the variables used by these workflow requests.',
  item: [
    {
      name: 'Payroll',
      item: [
        request({
          name: 'Calculate Payroll Snapshot',
          method: 'POST',
          url: urlFor('/api/v1/workflows/payroll/calculate'),
          body: { gross_salary: 15000, taxable_adjustments: 1000, non_taxable_adjustments: 500, deductions: 250 },
          events: basicSuccessEvent()
        }),
        request({
          name: 'Generate Payslips',
          method: 'POST',
          url: urlFor('/api/v1/workflows/payroll/runs/{{payrollRunId}}/generate-payslips'),
          body: { pensionRate: 0.07 },
          events: basicSuccessEvent([201])
        }),
        request({
          name: 'Approve Payroll Run',
          method: 'POST',
          url: urlFor('/api/v1/workflows/payroll/runs/{{payrollRunId}}/approve'),
          body: { approved_by: '{{employeeId}}' },
          events: basicSuccessEvent()
        }),
        request({
          name: 'Process Payroll Run',
          method: 'POST',
          url: urlFor('/api/v1/workflows/payroll/runs/{{payrollRunId}}/process'),
          body: { approved_by: '{{employeeId}}' },
          events: basicSuccessEvent()
        })
      ]
    },
    {
      name: 'Leave & Expenses',
      item: [
        request({
          name: 'Approve Leave Request',
          method: 'POST',
          url: urlFor('/api/v1/workflows/leave-requests/{{leaveRequestId}}/approve'),
          body: { approved_by: '{{employeeId}}' },
          events: basicSuccessEvent()
        }),
        request({
          name: 'Reject Leave Request',
          method: 'POST',
          url: urlFor('/api/v1/workflows/leave-requests/{{leaveRequestId}}/reject'),
          body: { approved_by: '{{employeeId}}' },
          events: basicSuccessEvent()
        }),
        request({
          name: 'Get Leave Balance',
          method: 'GET',
          url: urlFor('/api/v1/workflows/employees/{{employeeId}}/leave-balance?type_id={{leaveTypeId}}&year=2026'),
          events: basicSuccessEvent()
        }),
        request({
          name: 'Approve Expense Claim',
          method: 'POST',
          url: urlFor('/api/v1/workflows/expense-claims/{{claimId}}/approve'),
          body: { status: 'Approved', approver_id: '{{employeeId}}' },
          events: basicSuccessEvent()
        })
      ]
    },
    {
      name: 'Assets & Onboarding',
      item: [
        request({
          name: 'Assign Asset',
          method: 'POST',
          url: urlFor('/api/v1/workflows/assets/{{assetId}}/assign'),
          body: { employee_id: '{{employeeId}}', assigned_date: '2026-06-01' },
          events: savePathEvent('assetAssignmentId', 'data.assignment.assignment_id', [201])
        }),
        request({
          name: 'Return Asset',
          method: 'POST',
          url: urlFor('/api/v1/workflows/asset-assignments/{{assetAssignmentId}}/return'),
          body: { returned_date: '2026-06-15', condition_on_return: 'Good', asset_status: 'Available' },
          events: basicSuccessEvent()
        }),
        request({
          name: 'Create Onboarding Checklist',
          method: 'POST',
          url: urlFor('/api/v1/workflows/onboarding/checklists'),
          body: {
            employee_id: '{{employeeId}}',
            created_by: '{{employeeId}}',
            due_date: '2026-06-15',
            task_names: ['Submit national ID', 'Setup email account', 'Assign equipment']
          },
          events: testEvent([
            "pm.test('checklist created', function () { pm.response.to.have.status(201); });",
            'const json = pm.response.json();',
            "pm.environment.set('checklistId', json.data.checklist.checklist_id);",
            "if (json.data.tasks && json.data.tasks[0]) pm.environment.set('taskId', json.data.tasks[0].task_id);"
          ])
        }),
        request({
          name: 'Complete Onboarding Task',
          method: 'POST',
          url: urlFor('/api/v1/workflows/onboarding/tasks/{{taskId}}/complete'),
          body: { completed_by: '{{employeeId}}' },
          events: basicSuccessEvent()
        })
      ]
    },
    {
      name: 'Employee Relations & Exit',
      item: [
        request({
          name: 'Resolve Grievance',
          method: 'POST',
          url: urlFor('/api/v1/workflows/grievances/{{grievanceId}}/resolve'),
          body: { resolved_by: '{{employeeId}}', resolution_notes: 'Resolved from Postman', status: 'Resolved' },
          events: basicSuccessEvent()
        }),
        request({
          name: 'Exit Employee',
          method: 'POST',
          url: urlFor('/api/v1/workflows/employees/{{employeeId}}/exit'),
          body: {
            exit_type: 'Resignation',
            last_working_day: '2026-12-31',
            reason: 'Postman exit workflow',
            clearance_status: 'Pending'
          },
          events: basicSuccessEvent([201])
        })
      ]
    },
    {
      name: 'Recruitment & Promotion',
      item: [
        request({
          name: 'Hire Candidate',
          method: 'POST',
          url: urlFor('/api/v1/workflows/recruitment/candidates/{{candidateId}}/hire'),
          body: {
            hire_date: '2026-07-01',
            dept_id: '{{deptId}}',
            office_id: '{{officeId}}',
            manager_id: '{{employeeId}}'
          },
          events: savePathEvent('employeeId', 'data.employee.employee_id', [201])
        }),
        request({
          name: 'Assess Promotion',
          method: 'POST',
          url: urlFor('/api/v1/workflows/promotions/{{promotionId}}/assess'),
          body: {
            performance_review: 85,
            training_completed: true,
            attendance_score: 95,
            yrs_in_role: 2,
            disciplinary_7: false,
            assessed_by: '{{employeeId}}'
          },
          events: savePathEvent('assessmentId', 'data.assessment_id', [201])
        }),
        request({
          name: 'Approve Promotion',
          method: 'POST',
          url: urlFor('/api/v1/workflows/promotions/{{promotionId}}/action'),
          body: { action: 'Approved', approver_id: '{{employeeId}}', notes: 'Approved from Postman' },
          events: basicSuccessEvent()
        })
      ]
    },
    {
      name: 'Performance & Training',
      item: [
        request({
          name: 'Evaluate Performance Goal',
          method: 'POST',
          url: urlFor('/api/v1/workflows/performance/goals/{{performanceGoalId}}/evaluate'),
          body: { actual_value: 105, eval_date: '2026-12-15' },
          events: basicSuccessEvent()
        }),
        request({
          name: 'Close Performance Plan',
          method: 'POST',
          url: urlFor('/api/v1/workflows/performance/plans/{{performancePlanId}}/close'),
          body: {},
          events: basicSuccessEvent()
        }),
        request({
          name: 'Evaluate Training',
          method: 'POST',
          url: urlFor('/api/v1/workflows/trainings/{{trainingId}}/evaluate'),
          body: {
            score: 92,
            certificate_issued: true,
            certificate_expiry: '2027-06-01',
            evaluated_by: '{{employeeId}}',
            training_status: 'Completed'
          },
          events: savePathEvent('trainingEvaluationId', 'data.evaluation.eval_id', [201])
        })
      ]
    },
    {
      name: 'Documents',
      item: [
        formRequest({
          name: 'Upload Document',
          method: 'POST',
          url: urlFor('/api/v1/workflows/documents/upload'),
          formdata: [
            { key: 'entity_type', value: 'Employee', type: 'text' },
            { key: 'entity_id', value: '{{employeeId}}', type: 'text' },
            { key: 'description', value: 'Postman upload test', type: 'text' },
            { key: 'uploaded_by', value: '{{employeeId}}', type: 'text' },
            { key: 'file', type: 'file', src: [] }
          ],
          events: savePathEvent('documentId', 'data.document_id', [201]),
          description: 'Select any local file in the file field before sending.'
        })
      ]
    }
  ]
});

const schemaFolders = () => schemaOrder
  .map((schema, index) => {
    const resources = resourceList.filter((resource) => resource.schema === schema);
    return {
      name: `${String(index + 3).padStart(2, '0')} Schema - ${schema} (${schemaLabels[schema]})`,
      item: resources.map(tableRequests)
    };
  });

const collection = {
  info: {
    name: 'HR Operations Management API - Complete Test Suite',
    description: [
      'Import this collection with the HR Operations Local environment.',
      'Recommended order: Health & Auth, Metadata, Test Data Setup, Business Workflows, then schema CRUD folders as needed.',
      'The schema folders expose generic CRUD coverage for all 52 database tables. Workflow folders test the business features implemented in the backend.'
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{authToken}}', type: 'string' }]
  },
  item: [
    authFolder(),
    metadataFolder(),
    setupFolder(),
    ...schemaFolders(),
    workflowFolders()
  ]
};

const environment = {
  id: '0b11d809-61f9-4a62-bf35-hr-local-env',
  name: 'HR Operations Local',
  values: Array.from(environmentVariables).sort().map((key) => ({
    key,
    value: key === 'baseUrl' ? 'http://localhost:5000'
      : key === 'adminUsername' ? 'admin'
        : key === 'adminPassword' ? 'AdminPass123!'
          : '',
    type: ['adminPassword', 'authToken'].includes(key) ? 'secret' : 'default',
    enabled: true
  })),
  _postman_variable_scope: 'environment',
  _postman_exported_using: 'Codex'
};

fs.mkdirSync(postmanDir, { recursive: true });
fs.writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`);
fs.writeFileSync(environmentPath, `${JSON.stringify(environment, null, 2)}\n`);

console.log(`Wrote ${collectionPath}`);
console.log(`Wrote ${environmentPath}`);
console.log(`Collection folders: ${collection.item.length}`);
console.log(`Tables covered: ${resourceList.length}`);
