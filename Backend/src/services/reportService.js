const db = require('../config/db');
const AppError = require('../utils/AppError');

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate optional YYYY-MM-DD query parameters and chronological ordering. */
const parseDateRange = (query = {}) => {
  const startDate = query.start_date ? String(query.start_date).trim() : null;
  const endDate = query.end_date ? String(query.end_date).trim() : null;

  if (startDate && !ISO_DATE_RE.test(startDate)) {
    throw new AppError('start_date must be formatted as YYYY-MM-DD', 400);
  }
  if (endDate && !ISO_DATE_RE.test(endDate)) {
    throw new AppError('end_date must be formatted as YYYY-MM-DD', 400);
  }
  if (startDate && endDate && startDate > endDate) {
    throw new AppError('start_date cannot be after end_date', 400);
  }

  return { startDate, endDate };
};

/**
 * Aggregate executive HR, workforce, payroll, leave, attendance, asset,
 * and grievance metrics within an optional date window.
 */
const getOverview = async (query = {}, access = {}) => {
  const { startDate, endDate } = parseDateRange(query);
  const { includePayroll = false, includeGrievances = false } = access;
  const rangeParams = [startDate, endDate];

  const workforceSummarySql = `
    SELECT
      COUNT(*)::int AS total_employees,
      COUNT(*) FILTER (WHERE employment_status = 'Active')::int AS active_employees,
      COUNT(*) FILTER (WHERE employment_status = 'On Leave')::int AS on_leave_employees,
      COUNT(*) FILTER (WHERE employment_status IN ('Terminated', 'Resigned'))::int AS exited_employees,
      COUNT(*) FILTER (
        WHERE ($1::date IS NULL OR hire_date >= $1::date)
          AND ($2::date IS NULL OR hire_date <= $2::date)
      )::int AS new_hires
    FROM org.employee
    WHERE COALESCE(is_deleted, false) = false
  `;

  const departmentsSql = `
    WITH active_contracts AS (
      SELECT DISTINCT ON (sc.employee_id)
        sc.employee_id,
        COALESCE(sm.base_salary, 0)::numeric AS base_salary
      FROM payroll.salary_contracts sc
      LEFT JOIN payroll.salary_matrix sm ON sm.matrix_id = sc.matrix_id
      WHERE sc.is_active = true
        AND COALESCE(sc.is_deleted, false) = false
      ORDER BY sc.employee_id, sc.start_date DESC, sc.contract_id DESC
    )
    SELECT
      d.dept_id,
      d.dept_name,
      COALESCE(o.location_name, 'Unassigned') AS office_name,
      COUNT(e.employee_id)::int AS total_headcount,
      COUNT(e.employee_id) FILTER (WHERE e.employment_status = 'Active')::int AS active_headcount,
      COALESCE(SUM(ac.base_salary) FILTER (WHERE e.employment_status = 'Active'), 0)::numeric(14,2) AS monthly_payroll_commitment
    FROM org.departments d
    LEFT JOIN org.offices o ON o.office_id = d.office_id
    LEFT JOIN org.employee e
      ON e.dept_id = d.dept_id
     AND COALESCE(e.is_deleted, false) = false
    LEFT JOIN active_contracts ac ON ac.employee_id = e.employee_id
    GROUP BY d.dept_id, d.dept_name, o.location_name
    ORDER BY active_headcount DESC, total_headcount DESC, d.dept_name ASC
  `;

  const officesSql = `
    SELECT
      COALESCE(o.office_id, 0)::int AS office_id,
      COALESCE(o.location_name, 'Remote / Unassigned') AS location_name,
      COALESCE(o.city, '—') AS city,
      COUNT(e.employee_id)::int AS total_headcount,
      COUNT(e.employee_id) FILTER (WHERE e.employment_status = 'Active')::int AS active_headcount
    FROM org.employee e
    LEFT JOIN org.offices o ON o.office_id = e.office_id
    WHERE COALESCE(e.is_deleted, false) = false
    GROUP BY o.office_id, o.location_name, o.city
    ORDER BY active_headcount DESC, location_name ASC
  `;

  const demographicsSql = `
    SELECT
      COALESCE(NULLIF(TRIM(gender), ''), 'Unspecified') AS label,
      COUNT(*)::int AS count
    FROM org.employee
    WHERE COALESCE(is_deleted, false) = false
      AND employment_status = 'Active'
    GROUP BY label
    ORDER BY count DESC, label ASC
  `;

  const exitsSql = `
    SELECT
      COUNT(*)::int AS total_exits,
      COUNT(*) FILTER (WHERE clearance_status = 'Cleared')::int AS cleared_exits,
      COUNT(*) FILTER (WHERE clearance_status <> 'Cleared')::int AS pending_clearance
    FROM org.employee_exits
    WHERE ($1::date IS NULL OR last_working_day >= $1::date)
      AND ($2::date IS NULL OR last_working_day <= $2::date)
  `;

  const exitsByTypeSql = `
    SELECT
      exit_type,
      COUNT(*)::int AS count
    FROM org.employee_exits
    WHERE ($1::date IS NULL OR last_working_day >= $1::date)
      AND ($2::date IS NULL OR last_working_day <= $2::date)
    GROUP BY exit_type
    ORDER BY count DESC, exit_type ASC
  `;

  const onboardingSql = `
    SELECT
      (SELECT COUNT(*)::int FROM org.onboarding_checklists) AS total_checklists,
      (SELECT COUNT(*)::int FROM org.onboarding_checklists WHERE status = 'In_Progress') AS in_progress_checklists,
      (SELECT COUNT(*)::int FROM org.onboarding_checklists WHERE status = 'Completed') AS completed_checklists,
      (SELECT COUNT(*)::int FROM org.onboarding_tasks) AS total_tasks,
      (SELECT COUNT(*)::int FROM org.onboarding_tasks WHERE status = 'Done') AS completed_tasks
  `;

  const leaveByTypeSql = `
    SELECT
      COALESCE(lt.name, 'General Leave') AS type_name,
      COALESCE(lt.is_paid, true) AS is_paid,
      COUNT(lr.request_id)::int AS total_requests,
      COUNT(lr.request_id) FILTER (WHERE lr.status = 'Approved')::int AS approved_requests,
      COUNT(lr.request_id) FILTER (WHERE lr.status = 'Pending')::int AS pending_requests,
      COUNT(lr.request_id) FILTER (WHERE lr.status = 'Rejected')::int AS rejected_requests,
      COALESCE(
        SUM((lr.end_date - lr.start_date) + 1) FILTER (WHERE lr.status = 'Approved'),
        0
      )::int AS approved_days
    FROM payroll.leave_types lt
    LEFT JOIN payroll.leave_requests lr
      ON lr.type_id = lt.type_id
     AND ($1::date IS NULL OR lr.start_date >= $1::date)
     AND ($2::date IS NULL OR lr.start_date <= $2::date)
    GROUP BY lt.type_id, lt.name, lt.is_paid
    ORDER BY approved_days DESC, total_requests DESC, lt.name ASC
  `;

  const attendanceOvertimeSql = `
    SELECT
      (
        SELECT COUNT(*)::int
        FROM org.attendance
        WHERE ($1::date IS NULL OR date >= $1::date)
          AND ($2::date IS NULL OR date <= $2::date)
      ) AS attendance_logs,
      (
        SELECT COALESCE(ROUND(AVG(total_hours), 2), 0)::numeric(6,2)
        FROM org.attendance
        WHERE total_hours IS NOT NULL
          AND ($1::date IS NULL OR date >= $1::date)
          AND ($2::date IS NULL OR date <= $2::date)
      ) AS avg_daily_hours,
      (
        SELECT COALESCE(SUM(hours_worked), 0)::numeric(10,2)
        FROM org.overtime_records
        WHERE payment_status IN ('Approved', 'Paid')
          AND ($1::date IS NULL OR date >= $1::date)
          AND ($2::date IS NULL OR date <= $2::date)
      ) AS approved_overtime_hours
  `;

  const assetsSql = `
    SELECT
      asset_type,
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE status = 'Assigned')::int AS assigned_count,
      COUNT(*) FILTER (WHERE status = 'Available')::int AS available_count,
      COUNT(*) FILTER (WHERE status = 'Maintenance')::int AS maintenance_count,
      COUNT(*) FILTER (WHERE status = 'Retired')::int AS retired_count
    FROM org.assets
    WHERE COALESCE(is_deleted, false) = false
    GROUP BY asset_type
    ORDER BY total_count DESC, asset_type ASC
  `;

  const payrollSummarySql = `
    SELECT
      COUNT(DISTINCT pr.run_id)::int AS total_runs,
      COUNT(DISTINCT pr.run_id) FILTER (WHERE pr.status IN ('Approved', 'Processed'))::int AS finalized_runs,
      COUNT(ps.payslip_id)::int AS payslip_count,
      COALESCE(SUM(ps.gross_salary), 0)::numeric(14,2) AS total_gross,
      COALESCE(SUM(ps.tax_amount), 0)::numeric(14,2) AS total_tax,
      COALESCE(SUM(ps.pension_amount), 0)::numeric(14,2) AS total_pension,
      COALESCE(SUM(ps.net_pay), 0)::numeric(14,2) AS total_net,
      COALESCE(ROUND(AVG(ps.net_pay), 2), 0)::numeric(12,2) AS avg_net_pay
    FROM payroll.payroll_runs pr
    LEFT JOIN payroll.payslips ps ON ps.run_id = pr.run_id
    WHERE ($1::date IS NULL OR pr.run_date >= $1::date)
      AND ($2::date IS NULL OR pr.run_date <= $2::date)
  `;

  const payrollRunsSql = `
    SELECT
      pr.run_id,
      pr.run_date,
      pr.status,
      COUNT(ps.payslip_id)::int AS payslip_count,
      COALESCE(SUM(ps.gross_salary), 0)::numeric(14,2) AS total_gross,
      COALESCE(SUM(ps.tax_amount), 0)::numeric(14,2) AS total_tax,
      COALESCE(SUM(ps.pension_amount), 0)::numeric(14,2) AS total_pension,
      COALESCE(SUM(ps.net_pay), 0)::numeric(14,2) AS total_net
    FROM payroll.payroll_runs pr
    LEFT JOIN payroll.payslips ps ON ps.run_id = pr.run_id
    WHERE ($1::date IS NULL OR pr.run_date >= $1::date)
      AND ($2::date IS NULL OR pr.run_date <= $2::date)
    GROUP BY pr.run_id, pr.run_date, pr.status
    ORDER BY pr.run_date DESC, pr.run_id DESC
    LIMIT 24
  `;

  const expensesSql = `
    SELECT
      COALESCE(NULLIF(TRIM(category), ''), 'Other') AS category,
      COUNT(*)::int AS claim_count,
      COALESCE(SUM(amount), 0)::numeric(14,2) AS total_amount,
      COALESCE(SUM(amount) FILTER (WHERE status IN ('Approved', 'Paid')), 0)::numeric(14,2) AS approved_amount,
      COALESCE(SUM(amount) FILTER (WHERE status = 'Pending'), 0)::numeric(14,2) AS pending_amount
    FROM payroll.expense_claims
    WHERE ($1::date IS NULL OR submitted_date >= $1::date)
      AND ($2::date IS NULL OR submitted_date <= $2::date)
    GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'Other')
    ORDER BY total_amount DESC, claim_count DESC
  `;

  const grievancesSql = `
    SELECT
      COUNT(*)::int AS total_cases,
      COUNT(*) FILTER (WHERE status = 'Open')::int AS open_cases,
      COUNT(*) FILTER (WHERE status IN ('Under Review', 'Investigating'))::int AS active_cases,
      COUNT(*) FILTER (WHERE status IN ('Resolved', 'Dismissed'))::int AS closed_cases
    FROM org.grievances
    WHERE ($1::date IS NULL OR submitted_date >= $1::date)
      AND ($2::date IS NULL OR submitted_date <= $2::date)
  `;

  const grievancesByCategorySql = `
    SELECT
      COALESCE(NULLIF(TRIM(category), ''), 'Other') AS category,
      COUNT(*)::int AS count,
      COUNT(*) FILTER (WHERE status IN ('Resolved', 'Dismissed'))::int AS closed_count
    FROM org.grievances
    WHERE ($1::date IS NULL OR submitted_date >= $1::date)
      AND ($2::date IS NULL OR submitted_date <= $2::date)
    GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'Other')
    ORDER BY count DESC, category ASC
  `;

  const [
    workforceRes,
    departmentsRes,
    officesRes,
    demographicsRes,
    exitsRes,
    exitsByTypeRes,
    onboardingRes,
    leaveByTypeRes,
    attendanceOvertimeRes,
    assetsRes,
    payrollSummaryRes,
    payrollRunsRes,
    expensesRes,
    grievancesRes,
    grievancesByCatRes
  ] = await Promise.all([
    db.query(workforceSummarySql, rangeParams),
    db.query(departmentsSql),
    db.query(officesSql),
    db.query(demographicsSql),
    db.query(exitsSql, rangeParams),
    db.query(exitsByTypeSql, rangeParams),
    db.query(onboardingSql),
    db.query(leaveByTypeSql, rangeParams),
    db.query(attendanceOvertimeSql, rangeParams),
    db.query(assetsSql),
    includePayroll ? db.query(payrollSummarySql, rangeParams) : Promise.resolve({ rows: [] }),
    includePayroll ? db.query(payrollRunsSql, rangeParams) : Promise.resolve({ rows: [] }),
    includePayroll ? db.query(expensesSql, rangeParams) : Promise.resolve({ rows: [] }),
    includeGrievances ? db.query(grievancesSql, rangeParams) : Promise.resolve({ rows: [] }),
    includeGrievances ? db.query(grievancesByCategorySql, rangeParams) : Promise.resolve({ rows: [] })
  ]);

  const workforce = workforceRes.rows[0] || {};
  const exitStats = exitsRes.rows[0] || {};
  const activeCount = Number(workforce.active_employees || 0);
  const exitCount = Number(exitStats.total_exits || 0);
  const attritionRate = activeCount + exitCount > 0
    ? Number(((exitCount / (activeCount + exitCount)) * 100).toFixed(1))
    : 0;

  const onboarding = onboardingRes.rows[0] || {};
  const totalTasks = Number(onboarding.total_tasks || 0);
  const completedTasks = Number(onboarding.completed_tasks || 0);

  return {
    filters: { start_date: startDate, end_date: endDate },
    access: { includePayroll, includeGrievances },
    workforce: {
      total_employees: Number(workforce.total_employees || 0),
      active_employees: activeCount,
      on_leave_employees: Number(workforce.on_leave_employees || 0),
      exited_employees: Number(workforce.exited_employees || 0),
      new_hires: Number(workforce.new_hires || 0),
      attrition_rate: attritionRate,
      demographics: demographicsRes.rows.map((r) => ({ label: r.label, count: Number(r.count) })),
      departments: departmentsRes.rows.map((r) => ({
        dept_id: r.dept_id,
        dept_name: r.dept_name,
        office_name: r.office_name,
        total_headcount: Number(r.total_headcount),
        active_headcount: Number(r.active_headcount),
        monthly_payroll_commitment: includePayroll ? Number(r.monthly_payroll_commitment || 0) : null
      })),
      offices: officesRes.rows.map((r) => ({
        office_id: r.office_id,
        location_name: r.location_name,
        city: r.city,
        total_headcount: Number(r.total_headcount),
        active_headcount: Number(r.active_headcount)
      }))
    },
    lifecycle: {
      exits: {
        total_exits: exitCount,
        cleared_exits: Number(exitStats.cleared_exits || 0),
        pending_clearance: Number(exitStats.pending_clearance || 0),
        by_type: exitsByTypeRes.rows.map((r) => ({ exit_type: r.exit_type, count: Number(r.count) }))
      },
      onboarding: {
        total_checklists: Number(onboarding.total_checklists || 0),
        in_progress_checklists: Number(onboarding.in_progress_checklists || 0),
        completed_checklists: Number(onboarding.completed_checklists || 0),
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        task_completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
      }
    },
    leave_and_attendance: {
      by_type: leaveByTypeRes.rows.map((r) => ({
        type_name: r.type_name,
        is_paid: Boolean(r.is_paid),
        total_requests: Number(r.total_requests),
        approved_requests: Number(r.approved_requests),
        pending_requests: Number(r.pending_requests),
        rejected_requests: Number(r.rejected_requests),
        approved_days: Number(r.approved_days)
      })),
      attendance_logs: Number((attendanceOvertimeRes.rows[0] || {}).attendance_logs || 0),
      avg_daily_hours: Number((attendanceOvertimeRes.rows[0] || {}).avg_daily_hours || 0),
      approved_overtime_hours: Number((attendanceOvertimeRes.rows[0] || {}).approved_overtime_hours || 0)
    },
    assets: {
      by_type: assetsRes.rows.map((r) => ({
        asset_type: r.asset_type,
        total_count: Number(r.total_count),
        assigned_count: Number(r.assigned_count),
        available_count: Number(r.available_count),
        maintenance_count: Number(r.maintenance_count),
        retired_count: Number(r.retired_count)
      }))
    },
    payroll: includePayroll
      ? {
          summary: {
            total_runs: Number((payrollSummaryRes.rows[0] || {}).total_runs || 0),
            finalized_runs: Number((payrollSummaryRes.rows[0] || {}).finalized_runs || 0),
            payslip_count: Number((payrollSummaryRes.rows[0] || {}).payslip_count || 0),
            total_gross: Number((payrollSummaryRes.rows[0] || {}).total_gross || 0),
            total_tax: Number((payrollSummaryRes.rows[0] || {}).total_tax || 0),
            total_pension: Number((payrollSummaryRes.rows[0] || {}).total_pension || 0),
            total_net: Number((payrollSummaryRes.rows[0] || {}).total_net || 0),
            avg_net_pay: Number((payrollSummaryRes.rows[0] || {}).avg_net_pay || 0)
          },
          runs: payrollRunsRes.rows.map((r) => ({
            run_id: r.run_id,
            run_date: r.run_date,
            status: r.status,
            payslip_count: Number(r.payslip_count),
            total_gross: Number(r.total_gross),
            total_tax: Number(r.total_tax),
            total_pension: Number(r.total_pension),
            total_net: Number(r.total_net)
          })),
          expenses_by_category: expensesRes.rows.map((r) => ({
            category: r.category,
            claim_count: Number(r.claim_count),
            total_amount: Number(r.total_amount),
            approved_amount: Number(r.approved_amount),
            pending_amount: Number(r.pending_amount)
          }))
        }
      : null,
    grievances: includeGrievances
      ? {
          total_cases: Number((grievancesRes.rows[0] || {}).total_cases || 0),
          open_cases: Number((grievancesRes.rows[0] || {}).open_cases || 0),
          active_cases: Number((grievancesRes.rows[0] || {}).active_cases || 0),
          closed_cases: Number((grievancesRes.rows[0] || {}).closed_cases || 0),
          by_category: grievancesByCatRes.rows.map((r) => ({
            category: r.category,
            count: Number(r.count),
            closed_count: Number(r.closed_count)
          }))
        }
      : null
  };
};

module.exports = {
  parseDateRange,
  getOverview
};
