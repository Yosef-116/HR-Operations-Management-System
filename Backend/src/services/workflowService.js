const db = require('../config/db');
const auditService = require('./auditService');
const AppError = require('../utils/AppError');

const today = () => new Date().toISOString().slice(0, 10);

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fetchOne = async (client, sql, params, message) => {
  const result = await client.query(sql, params);
  if (!result.rows[0]) throw new AppError(message, 404);
  return result.rows[0];
};

const audit = (client, reqMeta, actionType, tableName, recordId, oldValue, newValue) => auditService.writeAuditLog({
  client,
  userId: reqMeta.userId,
  actionType,
  tableName,
  recordId,
  oldValue,
  newValue,
  ipAddress: reqMeta.ipAddress
});

const calculateIncomeTax = async (client, taxableIncome) => {
  const result = await client.query(
    `SELECT tax_rate, deductible_fee
     FROM payroll.tax_brackets_eth
     WHERE min_income <= $1 AND (max_income IS NULL OR max_income >= $1)
     ORDER BY min_income DESC
     LIMIT 1`,
    [taxableIncome]
  );

  if (!result.rows[0]) return 0;
  return Math.max(0, taxableIncome * number(result.rows[0].tax_rate) - number(result.rows[0].deductible_fee));
};

const calculatePayroll = async ({
  gross_salary,
  grossSalary,
  taxable_adjustments = 0,
  non_taxable_adjustments = 0,
  deductions = 0,
  pension_amount,
  pensionRate = 0.07
}) => db.withTransaction(async (client) => {
  const gross = number(gross_salary ?? grossSalary);
  const taxableAdjustments = number(taxable_adjustments);
  const nonTaxableAdjustments = number(non_taxable_adjustments);
  const otherDeductions = number(deductions);
  const pension = pension_amount === undefined ? gross * number(pensionRate, 0.07) : number(pension_amount);
  const taxableIncome = gross + taxableAdjustments;
  const tax = await calculateIncomeTax(client, taxableIncome);
  const netPay = gross + taxableAdjustments + nonTaxableAdjustments - tax - pension - otherDeductions;

  return {
    gross_salary: Number(gross.toFixed(2)),
    taxable_income: Number(taxableIncome.toFixed(2)),
    tax_amount: Number(tax.toFixed(2)),
    pension_amount: Number(pension.toFixed(2)),
    deductions: Number(otherDeductions.toFixed(2)),
    net_pay: Number(netPay.toFixed(2))
  };
});

// FIX: The original loop called `await client.query(...)` for every employee
// to check whether a payslip already existed — O(n) sequential DB round-trips
// inside a single transaction. For a company with 500 employees that is 500+
// extra queries before any payslip is written.
//
// The fix fetches ALL existing payslips for this run in a single query, builds
// a Set for O(1) lookups, and then iterates without any extra per-employee
// round-trip for the existence check.
const generatePayslips = async (runId, options, reqMeta) => db.withTransaction(async (client) => {
  const run = await fetchOne(
    client,
    'SELECT * FROM payroll.payroll_runs WHERE run_id = $1',
    [runId],
    'Payroll run not found'
  );

  if (run.status === 'Processed') {
    throw new AppError('Processed payroll runs cannot be regenerated', 409);
  }

  const contracts = await client.query(
    `SELECT sc.employee_id, sm.base_salary
     FROM payroll.salary_contracts sc
     JOIN payroll.salary_matrix sm ON sm.matrix_id = sc.matrix_id
     JOIN org.employee e ON e.employee_id = sc.employee_id
     WHERE sc.is_active = true
       AND COALESCE(sc.is_deleted, false) = false
       AND COALESCE(e.is_deleted, false) = false
       AND e.employment_status = 'Active'`
  );

  // Single query — replaces the per-employee SELECT inside the loop
  const existingResult = await client.query(
    'SELECT employee_id, payslip_id FROM payroll.payslips WHERE run_id = $1',
    [runId]
  );
  const alreadyProcessed = new Map(
    existingResult.rows.map((r) => [r.employee_id, r.payslip_id])
  );

  const created = [];
  const skipped = [];
  const pensionRate = number(options.pensionRate, 0.07);

  for (const contract of contracts.rows) {
    if (alreadyProcessed.has(contract.employee_id)) {
      skipped.push({
        employee_id: contract.employee_id,
        payslip_id: alreadyProcessed.get(contract.employee_id)
      });
      continue;
    }

    const adjustments = await client.query(
      `SELECT
         COALESCE(SUM(amount), 0)::numeric AS total_adjustments,
         COALESCE(SUM(CASE WHEN is_taxable THEN amount ELSE 0 END), 0)::numeric AS taxable_adjustments
       FROM payroll.payroll_adjustments
       WHERE employee_id = $1 AND run_id = $2`,
      [contract.employee_id, runId]
    );

    const baseSalary = number(contract.base_salary);
    const totalAdjustments = number(adjustments.rows[0].total_adjustments);
    const taxableAdjustments = number(adjustments.rows[0].taxable_adjustments);
    const grossSalary = baseSalary + totalAdjustments;
    const taxableIncome = baseSalary + taxableAdjustments;
    const taxAmount = await calculateIncomeTax(client, taxableIncome);
    const pensionAmount = baseSalary * pensionRate;
    const netPay = grossSalary - taxAmount - pensionAmount;

    const payslip = await client.query(
      `INSERT INTO payroll.payslips (employee_id, run_id, gross_salary, tax_amount, pension_amount, net_pay)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        contract.employee_id,
        runId,
        grossSalary.toFixed(2),
        taxAmount.toFixed(2),
        pensionAmount.toFixed(2),
        netPay.toFixed(2)
      ]
    );

    await client.query(
      `UPDATE payroll.payroll_adjustments
       SET payslip_id = $1, payment_status = 'Paid', updated_at = now()
       WHERE employee_id = $2 AND run_id = $3 AND payslip_id IS NULL`,
      [payslip.rows[0].payslip_id, contract.employee_id, runId]
    );

    await audit(client, reqMeta, 'INSERT', 'payroll.payslips', payslip.rows[0].payslip_id, null, payslip.rows[0]);
    created.push(payslip.rows[0]);
  }

  return {
    run,
    created,
    skipped
  };
});

const updatePayrollRunStatus = async (runId, status, actorId, reqMeta) => db.withTransaction(async (client) => {
  const oldRun = await fetchOne(client, 'SELECT * FROM payroll.payroll_runs WHERE run_id = $1', [runId], 'Payroll run not found');
  if (status === 'Processed' && oldRun.status !== 'Approved') {
    throw new AppError('Only approved payroll runs can be processed', 409);
  }

  const result = await client.query(
    `UPDATE payroll.payroll_runs
     SET status = $1, approved_by = COALESCE($2, approved_by)
     WHERE run_id = $3
     RETURNING *`,
    [status, actorId || null, runId]
  );

  await audit(client, reqMeta, 'UPDATE', 'payroll.payroll_runs', runId, oldRun, result.rows[0]);
  return result.rows[0];
});

const approveLeaveRequest = async (requestId, payload, reqMeta) => db.withTransaction(async (client) => {
  const oldRequest = await fetchOne(client, 'SELECT * FROM payroll.leave_requests WHERE request_id = $1', [requestId], 'Leave request not found');
  const status = payload.status || 'Approved';
  if (!['Approved', 'Rejected'].includes(status)) throw new AppError('Leave status must be Approved or Rejected', 400);

  const result = await client.query(
    `UPDATE payroll.leave_requests
     SET status = $1, approved_by = $2, updated_at = now()
     WHERE request_id = $3
     RETURNING *`,
    [status, payload.approved_by || reqMeta.employeeId || null, requestId]
  );

  await audit(client, reqMeta, 'UPDATE', 'payroll.leave_requests', requestId, oldRequest, result.rows[0]);
  return result.rows[0];
});

const getLeaveBalance = async (employeeId, typeId, yearValue) => db.withTransaction(async (client) => {
  const year = Number(yearValue || new Date().getFullYear());
  const employee = await fetchOne(client, 'SELECT employee_id, job_id FROM org.employee WHERE employee_id = $1', [employeeId], 'Employee not found');
  if (!employee.job_id) throw new AppError('Employee has no job title assigned', 409);

  const entitlement = await fetchOne(
    client,
    `SELECT *
     FROM payroll.leave_entitlements
     WHERE type_id = $1 AND job_id = $2`,
    [typeId, employee.job_id],
    'Leave entitlement not found for employee job'
  );

  const used = await client.query(
    `SELECT COALESCE(SUM((end_date - start_date) + 1), 0)::int AS used_days
     FROM payroll.leave_requests
     WHERE employee_id = $1
       AND type_id = $2
       AND status = 'Approved'
       AND start_date >= make_date($3, 1, 1)
       AND start_date < make_date($3 + 1, 1, 1)`,
    [employeeId, typeId, year]
  );

  return {
    employee_id: Number(employeeId),
    type_id: Number(typeId),
    year,
    days_per_year: entitlement.days_per_year,
    used_days: used.rows[0].used_days,
    remaining_days: Number(entitlement.days_per_year) - Number(used.rows[0].used_days),
    can_carry_over: entitlement.can_carry_over
  };
});

const approveExpenseClaim = async (claimId, payload, reqMeta) => db.withTransaction(async (client) => {
  const oldClaim = await fetchOne(client, 'SELECT * FROM payroll.expense_claims WHERE claim_id = $1', [claimId], 'Expense claim not found');
  const status = payload.status || 'Approved';
  if (!['Approved', 'Rejected', 'Paid'].includes(status)) throw new AppError('Expense status must be Approved, Rejected, or Paid', 400);

  const updated = await client.query(
    `UPDATE payroll.expense_claims
     SET status = $1, updated_at = now()
     WHERE claim_id = $2
     RETURNING *`,
    [status, claimId]
  );

  let approval = null;
  if (status === 'Approved') {
    const approvalResult = await client.query(
      `INSERT INTO payroll.claim_approvals (claim_id, approver_id)
       VALUES ($1, $2)
       RETURNING *`,
      [claimId, payload.approver_id || reqMeta.employeeId || null]
    );
    approval = approvalResult.rows[0];
    await audit(client, reqMeta, 'INSERT', 'payroll.claim_approvals', approval.approval_id, null, approval);
  }

  await audit(client, reqMeta, 'UPDATE', 'payroll.expense_claims', claimId, oldClaim, updated.rows[0]);
  return {
    claim: updated.rows[0],
    approval
  };
});

const assignAsset = async (assetId, payload, reqMeta) => db.withTransaction(async (client) => {
  const oldAsset = await fetchOne(client, 'SELECT * FROM org.assets WHERE asset_id = $1', [assetId], 'Asset not found');
  if (oldAsset.is_deleted) throw new AppError('Deleted assets cannot be assigned', 409);
  if (oldAsset.status !== 'Available') throw new AppError('Only available assets can be assigned', 409);

  const assignment = await client.query(
    `INSERT INTO org.asset_assignments (asset_id, employee_id, assigned_date)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [assetId, payload.employee_id, payload.assigned_date || today()]
  );

  const updatedAsset = await client.query(
    `UPDATE org.assets SET status = 'Assigned' WHERE asset_id = $1 RETURNING *`,
    [assetId]
  );

  await audit(client, reqMeta, 'INSERT', 'org.asset_assignments', assignment.rows[0].assignment_id, null, assignment.rows[0]);
  await audit(client, reqMeta, 'UPDATE', 'org.assets', assetId, oldAsset, updatedAsset.rows[0]);

  return {
    assignment: assignment.rows[0],
    asset: updatedAsset.rows[0]
  };
});

const returnAsset = async (assignmentId, payload, reqMeta) => db.withTransaction(async (client) => {
  const assignment = await fetchOne(client, 'SELECT * FROM org.asset_assignments WHERE assignment_id = $1', [assignmentId], 'Asset assignment not found');
  const oldAsset = await fetchOne(client, 'SELECT * FROM org.assets WHERE asset_id = $1', [assignment.asset_id], 'Asset not found');

  const updatedAssignment = await client.query(
    `UPDATE org.asset_assignments
     SET returned_date = $1, condition_on_return = $2, updated_at = now()
     WHERE assignment_id = $3
     RETURNING *`,
    [payload.returned_date || today(), payload.condition_on_return || null, assignmentId]
  );

  const assetStatus = payload.asset_status || 'Available';
  const updatedAsset = await client.query(
    `UPDATE org.assets SET status = $1, condition = COALESCE($2, condition) WHERE asset_id = $3 RETURNING *`,
    [assetStatus, payload.condition_on_return || null, assignment.asset_id]
  );

  await audit(client, reqMeta, 'UPDATE', 'org.asset_assignments', assignmentId, assignment, updatedAssignment.rows[0]);
  await audit(client, reqMeta, 'UPDATE', 'org.assets', assignment.asset_id, oldAsset, updatedAsset.rows[0]);

  return {
    assignment: updatedAssignment.rows[0],
    asset: updatedAsset.rows[0]
  };
});

const createOnboardingChecklist = async (payload, reqMeta) => db.withTransaction(async (client) => {
  const taskNames = Array.isArray(payload.task_names) && payload.task_names.length
    ? payload.task_names
    : ['Submit national ID', 'Sign employment contract', 'Setup email account', 'Assign equipment'];

  const checklist = await client.query(
    `INSERT INTO org.onboarding_checklists (employee_id, created_by, status)
     VALUES ($1, $2, 'In_Progress')
     RETURNING *`,
    [payload.employee_id, payload.created_by || reqMeta.employeeId || null]
  );

  const tasks = [];
  for (const taskName of taskNames) {
    const task = await client.query(
      `INSERT INTO org.onboarding_tasks (checklist_id, task_name, due_date, status)
       VALUES ($1, $2, $3, 'Pending')
       RETURNING *`,
      [checklist.rows[0].checklist_id, taskName, payload.due_date || null]
    );
    tasks.push(task.rows[0]);
  }

  await audit(client, reqMeta, 'INSERT', 'org.onboarding_checklists', checklist.rows[0].checklist_id, null, checklist.rows[0]);
  return {
    checklist: checklist.rows[0],
    tasks
  };
});

const completeOnboardingTask = async (taskId, payload, reqMeta) => db.withTransaction(async (client) => {
  const oldTask = await fetchOne(client, 'SELECT * FROM org.onboarding_tasks WHERE task_id = $1', [taskId], 'Onboarding task not found');
  const task = await client.query(
    `UPDATE org.onboarding_tasks
     SET status = 'Done', completed_by = $1, updated_at = now()
     WHERE task_id = $2
     RETURNING *`,
    [payload.completed_by || reqMeta.employeeId || null, taskId]
  );

  const openTasks = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM org.onboarding_tasks
     WHERE checklist_id = $1 AND status <> 'Done'`,
    [task.rows[0].checklist_id]
  );

  let checklist = null;
  if (openTasks.rows[0].total === 0) {
    const checklistResult = await client.query(
      `UPDATE org.onboarding_checklists
       SET status = 'Completed', updated_at = now()
       WHERE checklist_id = $1
       RETURNING *`,
      [task.rows[0].checklist_id]
    );
    checklist = checklistResult.rows[0];
  }

  await audit(client, reqMeta, 'UPDATE', 'org.onboarding_tasks', taskId, oldTask, task.rows[0]);
  return {
    task: task.rows[0],
    checklist
  };
});

const exitEmployee = async (employeeId, payload, reqMeta) => db.withTransaction(async (client) => {
  const oldEmployee = await fetchOne(client, 'SELECT * FROM org.employee WHERE employee_id = $1', [employeeId], 'Employee not found');
  const exitType = payload.exit_type || 'Resignation';
  const lastWorkingDay = payload.last_working_day || today();
  const status = exitType === 'Resignation' ? 'Resigned' : 'Terminated';

  const exit = await client.query(
    `INSERT INTO org.employee_exits (employee_id, exit_type, last_working_day, reason, clearance_status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [employeeId, exitType, lastWorkingDay, payload.reason || null, payload.clearance_status || 'Pending']
  );

  const employee = await client.query(
    `UPDATE org.employee
     SET employment_status = $1, terminated_date = $2, updated_at = now()
     WHERE employee_id = $3
     RETURNING *`,
    [status, lastWorkingDay, employeeId]
  );

  await client.query(
    `UPDATE payroll.salary_contracts
     SET is_active = false, end_date = COALESCE(end_date, $1)
     WHERE employee_id = $2 AND is_active = true`,
    [lastWorkingDay, employeeId]
  );

  await audit(client, reqMeta, 'INSERT', 'org.employee_exits', exit.rows[0].exit_id, null, exit.rows[0]);
  await audit(client, reqMeta, 'UPDATE', 'org.employee', employeeId, oldEmployee, employee.rows[0]);

  return {
    exit: exit.rows[0],
    employee: employee.rows[0]
  };
});

const fileGrievance = async (payload, reqMeta) => db.withTransaction(async (client) => {
  if (!reqMeta.employeeId) {
    throw new AppError('Your account is not linked to an employee record', 403);
  }

  if (!payload.description || !String(payload.description).trim()) {
    throw new AppError('Grievance description is required', 400);
  }

  const employee = await fetchOne(
    client,
    `SELECT employee_id
     FROM org.employee
     WHERE employee_id = $1
       AND COALESCE(is_deleted, false) = false`,
    [reqMeta.employeeId],
    'Employee record not found'
  );

  const result = await client.query(
    `INSERT INTO org.grievances (employee_id, submitted_date, category, description, status)
     VALUES ($1, $2, $3, $4, 'Open')
     RETURNING *`,
    [
      employee.employee_id,
      payload.submitted_date || today(),
      payload.category || 'Other',
      String(payload.description).trim()
    ]
  );

  await audit(client, reqMeta, 'INSERT', 'org.grievances', result.rows[0].grievance_id, null, result.rows[0]);
  return result.rows[0];
});

const resolveGrievance = async (grievanceId, payload, reqMeta) => db.withTransaction(async (client) => {
  const oldGrievance = await fetchOne(client, 'SELECT * FROM org.grievances WHERE grievance_id = $1', [grievanceId], 'Grievance not found');
  const result = await client.query(
    `UPDATE org.grievances
     SET status = $1,
         resolved_by = $2,
         resolution_date = $3,
         resolution_notes = $4,
         updated_at = now()
     WHERE grievance_id = $5
     RETURNING *`,
    [payload.status || 'Resolved', payload.resolved_by || reqMeta.employeeId || null, payload.resolution_date || today(), payload.resolution_notes || null, grievanceId]
  );

  await audit(client, reqMeta, 'UPDATE', 'org.grievances', grievanceId, oldGrievance, result.rows[0]);
  return result.rows[0];
});

const hireCandidate = async (candidateId, payload, reqMeta) => db.withTransaction(async (client) => {
  const candidate = await fetchOne(
    client,
    `SELECT c.*, v.job_id, v.no_of_positions, v.status AS vacancy_status
     FROM recruitment.candidates c
     LEFT JOIN recruitment.vacancies v ON v.vacancy_id = c.vacancy_id
     WHERE c.candidate_id = $1 AND COALESCE(c.is_deleted, false) = false`,
    [candidateId],
    'Candidate not found'
  );

  const employee = await client.query(
    `INSERT INTO org.employee (
       f_name, l_name, email, gender, birth_date, national_id, nationality,
       hire_date, employment_status, dept_id, job_id, office_id, manager_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active', $9, $10, $11, $12)
     RETURNING *`,
    [
      payload.f_name || candidate.f_name,
      payload.l_name || candidate.l_name,
      payload.email || candidate.email,
      payload.gender || null,
      payload.birth_date || null,
      payload.national_id || null,
      payload.nationality || null,
      payload.hire_date || today(),
      payload.dept_id || null,
      payload.job_id || candidate.job_id || null,
      payload.office_id || null,
      payload.manager_id || null
    ]
  );

  const resultUpdate = await client.query(
    `UPDATE recruitment.recruitment_results
     SET status = 'Hired', updated_at = now()
     WHERE candidate_id = $1
     RETURNING *`,
    [candidateId]
  );

  let recruitmentResult = resultUpdate.rows[0] || null;
  if (!recruitmentResult) {
    const insertedResult = await client.query(
      `INSERT INTO recruitment.recruitment_results (candidate_id, status)
       VALUES ($1, 'Hired')
       RETURNING *`,
      [candidateId]
    );
    recruitmentResult = insertedResult.rows[0];
  }

  let vacancy = null;
  if (candidate.vacancy_id) {
    const vacancyResult = await client.query(
      `UPDATE recruitment.vacancies
       SET no_of_positions = GREATEST(COALESCE(no_of_positions, 1) - 1, 0),
           status = CASE WHEN GREATEST(COALESCE(no_of_positions, 1) - 1, 0) = 0 THEN 'Filled' ELSE status END
       WHERE vacancy_id = $1
       RETURNING *`,
      [candidate.vacancy_id]
    );
    vacancy = vacancyResult.rows[0];
  }

  await audit(client, reqMeta, 'INSERT', 'org.employee', employee.rows[0].employee_id, null, employee.rows[0]);
  await audit(client, reqMeta, 'UPDATE', 'recruitment.recruitment_results', recruitmentResult.result_id, null, recruitmentResult);

  return {
    employee: employee.rows[0],
    recruitment_result: recruitmentResult,
    vacancy
  };
});

const assessPromotion = async (promotionId, payload, reqMeta) => db.withTransaction(async (client) => {
  await fetchOne(client, 'SELECT * FROM people.promotions WHERE promotion_id = $1', [promotionId], 'Promotion not found');

  const performance = number(payload.performance_review);
  const attendance = number(payload.attendance_score);
  const training = payload.training_completed ? 100 : 0;
  const years = Math.min(number(payload.yrs_in_role) * 10, 100);
  const penalty = payload.disciplinary_7 ? 15 : 0;
  const overall = payload.overall_score === undefined
    ? Math.max(0, (performance * 0.4) + (attendance * 0.25) + (training * 0.2) + (years * 0.15) - penalty)
    : number(payload.overall_score);

  const assessment = await client.query(
    `INSERT INTO people.promotion_criteria_assessment (
       promotion_id, performance_review, training_completed, attendance_score,
       yrs_in_role, disciplinary_7, overall_score, assessment_date, assessed_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      promotionId,
      payload.performance_review || null,
      Boolean(payload.training_completed),
      payload.attendance_score || null,
      payload.yrs_in_role || null,
      Boolean(payload.disciplinary_7),
      overall.toFixed(2),
      payload.assessment_date || today(),
      payload.assessed_by || reqMeta.employeeId || null
    ]
  );

  await audit(client, reqMeta, 'INSERT', 'people.promotion_criteria_assessment', assessment.rows[0].assessment_id, null, assessment.rows[0]);
  return assessment.rows[0];
});

const actOnPromotion = async (promotionId, payload, reqMeta) => db.withTransaction(async (client) => {
  const promotion = await fetchOne(client, 'SELECT * FROM people.promotions WHERE promotion_id = $1', [promotionId], 'Promotion not found');
  const action = payload.action || 'Approved';
  if (!['Approved', 'Rejected', 'Returned'].includes(action)) {
    throw new AppError('Promotion action must be Approved, Rejected, or Returned', 400);
  }

  const log = await client.query(
    `INSERT INTO people.promotionapproval_log (promotion_id, approver_id, action, notes, action_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [promotionId, payload.approver_id || reqMeta.employeeId || null, action, payload.notes || null, payload.action_date || today()]
  );

  const newStatus = action === 'Returned' ? 'Pending' : action;
  const updatedPromotion = await client.query(
    `UPDATE people.promotions SET status = $1, updated_at = now() WHERE promotion_id = $2 RETURNING *`,
    [newStatus, promotionId]
  );

  let employee = null;
  let salaryContract = null;
  if (action === 'Approved') {
    if (promotion.new_job_id) {
      const employeeResult = await client.query(
        `UPDATE org.employee SET job_id = $1, updated_at = now() WHERE employee_id = $2 RETURNING *`,
        [promotion.new_job_id, promotion.employee_id]
      );
      employee = employeeResult.rows[0];
    }

    if (promotion.new_matrix_id) {
      await client.query(
        `UPDATE payroll.salary_contracts
         SET is_active = false, end_date = COALESCE(end_date, ($1::date - INTERVAL '1 day')::date)
         WHERE employee_id = $2 AND is_active = true`,
        [promotion.effective_date, promotion.employee_id]
      );
      const contractResult = await client.query(
        `INSERT INTO payroll.salary_contracts (employee_id, matrix_id, contract_type, start_date, is_active, approved_by, signed_date)
         VALUES ($1, $2, 'Permanent', $3, true, $4, $5)
         RETURNING *`,
        [promotion.employee_id, promotion.new_matrix_id, promotion.effective_date, payload.approver_id || reqMeta.employeeId || null, today()]
      );
      salaryContract = contractResult.rows[0];
    }
  }

  await audit(client, reqMeta, 'INSERT', 'people.promotionapproval_log', log.rows[0].log_id, null, log.rows[0]);
  await audit(client, reqMeta, 'UPDATE', 'people.promotions', promotionId, promotion, updatedPromotion.rows[0]);

  return {
    promotion: updatedPromotion.rows[0],
    log: log.rows[0],
    employee,
    salary_contract: salaryContract
  };
});

const evaluateGoal = async (goalId, payload, reqMeta) => db.withTransaction(async (client) => {
  const oldGoal = await fetchOne(client, 'SELECT * FROM performance.performance_goals WHERE goal_id = $1', [goalId], 'Performance goal not found');
  const actual = number(payload.actual_value);
  const target = number(oldGoal.target_value);
  const status = payload.status || (target > 0 && actual >= target ? 'Achieved' : 'Missed');

  const result = await client.query(
    `UPDATE performance.performance_goals
     SET actual_value = $1, status = $2, eval_date = $3, updated_at = now()
     WHERE goal_id = $4
     RETURNING *`,
    [actual, status, payload.eval_date || today(), goalId]
  );

  await audit(client, reqMeta, 'UPDATE', 'performance.performance_goals', goalId, oldGoal, result.rows[0]);
  return result.rows[0];
});

const closePerformancePlan = async (planId, reqMeta) => db.withTransaction(async (client) => {
  const oldPlan = await fetchOne(client, 'SELECT * FROM performance.performance_plans WHERE plan_id = $1', [planId], 'Performance plan not found');
  const score = await client.query(
    `SELECT
       COALESCE(SUM((actual_value / NULLIF(target_value, 0)) * weight), 0) AS weighted_score,
       COALESCE(SUM(weight), 0) AS total_weight
     FROM performance.performance_goals
     WHERE plan_id = $1 AND actual_value IS NOT NULL AND target_value IS NOT NULL AND weight IS NOT NULL`,
    [planId]
  );

  const totalWeight = number(score.rows[0].total_weight);
  const overallRating = totalWeight ? number(score.rows[0].weighted_score) / totalWeight * 100 : 0;

  const plan = await client.query(
    `UPDATE performance.performance_plans
     SET plan_status = 'Closed', updated_at = now()
     WHERE plan_id = $1
     RETURNING *`,
    [planId]
  );

  await audit(client, reqMeta, 'UPDATE', 'performance.performance_plans', planId, oldPlan, plan.rows[0]);
  return {
    plan: plan.rows[0],
    overall_rating: Number(overallRating.toFixed(2))
  };
});

const evaluateTraining = async (trainingId, payload, reqMeta) => db.withTransaction(async (client) => {
  const oldTraining = await fetchOne(client, 'SELECT * FROM training.trainings WHERE training_id = $1', [trainingId], 'Training not found');
  const evaluation = await client.query(
    `INSERT INTO training.training_evaluations (training_id, score, certificate_issued, certificate_expiry, evaluated_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      trainingId,
      payload.score || null,
      Boolean(payload.certificate_issued),
      payload.certificate_expiry || null,
      payload.evaluated_by || reqMeta.employeeId || null
    ]
  );

  const training = await client.query(
    `UPDATE training.trainings
     SET status = $1, updated_at = now()
     WHERE training_id = $2
     RETURNING *`,
    [payload.training_status || 'Completed', trainingId]
  );

  await audit(client, reqMeta, 'INSERT', 'training.training_evaluations', evaluation.rows[0].eval_id, null, evaluation.rows[0]);
  await audit(client, reqMeta, 'UPDATE', 'training.trainings', trainingId, oldTraining, training.rows[0]);

  return {
    training: training.rows[0],
    evaluation: evaluation.rows[0]
  };
});

const recordDocument = async (file, payload, reqMeta) => db.withTransaction(async (client) => {
  if (!file) throw new AppError('A file upload is required', 400);

  const document = await client.query(
    `INSERT INTO shared.documents (
       entity_type, entity_id, file_name, file_path, file_type, description, uploaded_by, upload_date
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      payload.entity_type,
      payload.entity_id,
      file.originalname,
      file.path,
      file.mimetype,
      payload.description || null,
      payload.uploaded_by || reqMeta.employeeId || null,
      payload.upload_date || today()
    ]
  );

  await audit(client, reqMeta, 'INSERT', 'shared.documents', document.rows[0].document_id, null, document.rows[0]);
  return document.rows[0];
});

module.exports = {
  calculatePayroll,
  generatePayslips,
  updatePayrollRunStatus,
  approveLeaveRequest,
  getLeaveBalance,
  approveExpenseClaim,
  assignAsset,
  returnAsset,
  createOnboardingChecklist,
  completeOnboardingTask,
  exitEmployee,
  fileGrievance,
  resolveGrievance,
  hireCandidate,
  assessPromotion,
  actOnPromotion,
  evaluateGoal,
  closePerformancePlan,
  evaluateTraining,
  recordDocument
};
