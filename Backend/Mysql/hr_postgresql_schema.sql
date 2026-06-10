-- HR and Operations Management System
-- DROP SCHEMA IF EXISTS shared, hr_auth, training, performance, people, payroll, recruitment, org CASCADE;

CREATE SCHEMA IF NOT EXISTS org;
CREATE SCHEMA IF NOT EXISTS recruitment;
CREATE SCHEMA IF NOT EXISTS payroll;
CREATE SCHEMA IF NOT EXISTS people;
CREATE SCHEMA IF NOT EXISTS performance;
CREATE SCHEMA IF NOT EXISTS training;
CREATE SCHEMA IF NOT EXISTS hr_auth;
CREATE SCHEMA IF NOT EXISTS shared;

-- Table 2.1: Employee
CREATE TABLE org.employee (
    employee_id SERIAL,
    f_name VARCHAR(50) NOT NULL,
    l_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    gender VARCHAR(10),
    birth_date DATE,
    national_id VARCHAR(30) UNIQUE,
    nationality VARCHAR(60),
    hire_date DATE NOT NULL,
    employment_status VARCHAR(20) NOT NULL,
    terminated_date DATE,
    dept_id INTEGER,
    job_id INTEGER,
    office_id INTEGER,
    manager_id INTEGER,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT employee_pkey PRIMARY KEY (employee_id)
);

-- Table 2.2: Departments
CREATE TABLE org.departments (
    dept_id SERIAL,
    dept_name VARCHAR(100) NOT NULL,
    office_id INTEGER,
    CONSTRAINT departments_pkey PRIMARY KEY (dept_id)
);

-- Table 2.3: Offices
CREATE TABLE org.offices (
    office_id SERIAL,
    location_name VARCHAR(100) NOT NULL,
    city VARCHAR(100),
    addresses TEXT,
    CONSTRAINT offices_pkey PRIMARY KEY (office_id)
);

-- Table 2.4: Shifts
CREATE TABLE org.shifts (
    shift_id SERIAL,
    shift_name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    department_id INTEGER,
    CONSTRAINT shifts_pkey PRIMARY KEY (shift_id)
);

-- Table 2.5: Emergency_contacts
CREATE TABLE org.emergency_contacts (
    contact_id SERIAL,
    employee_id INTEGER,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    CONSTRAINT emergency_contacts_pkey PRIMARY KEY (contact_id)
);

-- Table 2.6: Dependants
CREATE TABLE org.dependants (
    dependant_id SERIAL,
    employee_id INTEGER,
    f_name VARCHAR(50) NOT NULL,
    l_name VARCHAR(50) NOT NULL,
    relationship VARCHAR(50) NOT NULL,
    CONSTRAINT dependants_pkey PRIMARY KEY (dependant_id)
);

-- Table 2.7: Attendance
CREATE TABLE org.attendance (
    attendance_id SERIAL,
    employee_id INTEGER,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    check_in TIME,
    check_out TIME,
    total_hours DECIMAL(5,2),
    location_type VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT attendance_pkey PRIMARY KEY (attendance_id)
);

-- Table 2.8: Overtime_records
CREATE TABLE org.overtime_records (
    overtime_id SERIAL,
    employee_id INTEGER,
    date DATE NOT NULL,
    hours_worked DECIMAL(5,2) NOT NULL,
    approved_by INTEGER,
    payment_status VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT overtime_records_pkey PRIMARY KEY (overtime_id)
);

-- Table 2.9: Onboarding_checklists
CREATE TABLE org.onboarding_checklists (
    checklist_id SERIAL,
    employee_id INTEGER,
    created_by INTEGER,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT onboarding_checklists_pkey PRIMARY KEY (checklist_id)
);

-- Table 2.10: Onboarding_tasks
CREATE TABLE org.onboarding_tasks (
    task_id SERIAL,
    checklist_id INTEGER,
    task_name VARCHAR(200) NOT NULL,
    due_date DATE,
    completed_by INTEGER,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT onboarding_tasks_pkey PRIMARY KEY (task_id)
);

-- Table 2.11: Employee_exits
CREATE TABLE org.employee_exits (
    exit_id SERIAL,
    employee_id INTEGER,
    exit_type VARCHAR(30) NOT NULL,
    last_working_day DATE NOT NULL,
    reason TEXT,
    clearance_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT employee_exits_pkey PRIMARY KEY (exit_id)
);

-- Table 2.12: Grievances
CREATE TABLE org.grievances (
    grievance_id SERIAL,
    employee_id INTEGER,
    submitted_date DATE NOT NULL,
    category VARCHAR(100),
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    resolved_by INTEGER,
    resolution_date DATE,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT grievances_pkey PRIMARY KEY (grievance_id)
);

-- Table 2.13: Disciplinary_actions
CREATE TABLE org.disciplinary_actions (
    action_id SERIAL,
    employee_id INTEGER,
    action_type VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    action_date DATE NOT NULL,
    issued_by INTEGER,
    appeal_status VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT disciplinary_actions_pkey PRIMARY KEY (action_id)
);

-- Table 2.14: Assets
CREATE TABLE org.assets (
    asset_id SERIAL,
    asset_name VARCHAR(200) NOT NULL,
    asset_type VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100) UNIQUE,
    purchase_date DATE,
    condition VARCHAR(30),
    status VARCHAR(20) NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT assets_pkey PRIMARY KEY (asset_id)
);

-- Table 2.15: Asset_assignments
CREATE TABLE org.asset_assignments (
    assignment_id SERIAL,
    asset_id INTEGER,
    employee_id INTEGER,
    assigned_date DATE NOT NULL,
    returned_date DATE,
    condition_on_return VARCHAR(30),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT asset_assignments_pkey PRIMARY KEY (assignment_id)
);

-- Table 2.16: Employee_Shifts
CREATE TABLE org.employee_shifts (
    employee_id INTEGER,
    shift_id INTEGER,
    assigned_date DATE NOT NULL,
    end_date DATE,
    CONSTRAINT employee_shifts_pkey PRIMARY KEY (employee_id, shift_id)
);

-- Table 2.17: Employee_phones
CREATE TABLE org.employee_phones (
    phone_id SERIAL,
    employee_id INTEGER,
    phone_type VARCHAR(30) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    CONSTRAINT employee_phones_pkey PRIMARY KEY (phone_id)
);

-- Table 2.18: Employee_addresses
CREATE TABLE org.employee_addresses (
    address_id SERIAL,
    employee_id INTEGER,
    address_type VARCHAR(30) NOT NULL,
    address_line TEXT NOT NULL,
    city VARCHAR(100),
    is_primary BOOLEAN DEFAULT false,
    CONSTRAINT employee_addresses_pkey PRIMARY KEY (address_id)
);

-- Table 2.19: Promotions
CREATE TABLE people.promotions (
    promotion_id SERIAL,
    employee_id INTEGER,
    old_job_id INTEGER,
    new_job_id INTEGER,
    old_matrix_id INTEGER,
    new_matrix_id INTEGER,
    promotion_type VARCHAR(50) NOT NULL,
    effective_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT promotions_pkey PRIMARY KEY (promotion_id)
);

-- Table 2.20: Promotion_criteria_assessment
CREATE TABLE people.promotion_criteria_assessment (
    assessment_id SERIAL,
    promotion_id INTEGER,
    performance_review DECIMAL(5,2),
    training_completed BOOLEAN DEFAULT false,
    attendance_score DECIMAL(5,2),
    yrs_in_role DECIMAL(4,1),
    disciplinary_7 BOOLEAN DEFAULT false,
    overall_score DECIMAL(5,2),
    assessment_date DATE NOT NULL,
    assessed_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT promotion_criteria_assessment_pkey PRIMARY KEY (assessment_id)
);

-- Table 2.21: Promotionapproval_log
CREATE TABLE people.promotionapproval_log (
    log_id SERIAL,
    promotion_id INTEGER,
    approver_id INTEGER,
    action VARCHAR(20) NOT NULL,
    notes TEXT,
    action_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT promotionapproval_log_pkey PRIMARY KEY (log_id)
);

-- Table 2.22: Tax_Brackets_ETH
CREATE TABLE payroll.tax_brackets_eth (
    bracket_id SERIAL,
    min_income DECIMAL(12,2) NOT NULL,
    max_income DECIMAL(12,2),
    tax_rate DECIMAL(5,4) NOT NULL,
    deductible_fee DECIMAL(12,2),
    CONSTRAINT tax_brackets_eth_pkey PRIMARY KEY (bracket_id)
);

-- Table 2.23: Salary_matrix
CREATE TABLE payroll.salary_matrix (
    matrix_id SERIAL,
    level VARCHAR(50) NOT NULL,
    step INTEGER NOT NULL,
    base_salary DECIMAL(12,2) NOT NULL,
    CONSTRAINT salary_matrix_pkey PRIMARY KEY (matrix_id)
);

-- Table 2.24: Salary_contracts
CREATE TABLE payroll.salary_contracts (
    contract_id SERIAL,
    employee_id INTEGER,
    matrix_id INTEGER,
    contract_type VARCHAR(30) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    probation_end_date DATE,
    is_active BOOLEAN NOT NULL,
    approved_by INTEGER,
    signed_date DATE,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT salary_contracts_pkey PRIMARY KEY (contract_id)
);

-- Table 2.25: Payroll_runs
CREATE TABLE payroll.payroll_runs (
    run_id SERIAL,
    run_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    run_by INTEGER,
    approved_by INTEGER,
    CONSTRAINT payroll_runs_pkey PRIMARY KEY (run_id)
);

-- Table 2.26: Payslips
CREATE TABLE payroll.payslips (
    payslip_id SERIAL,
    employee_id INTEGER,
    run_id INTEGER,
    gross_salary DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) NOT NULL,
    pension_amount DECIMAL(12,2),
    net_pay DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT payslips_pkey PRIMARY KEY (payslip_id)
);

-- Table 2.27: Employee_deductions
CREATE TABLE payroll.employee_deductions (
    deduction_instance_id SERIAL,
    employee_id INTEGER,
    payslip_id INTEGER,
    type_name VARCHAR(100) NOT NULL,
    amount_deducted DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT employee_deductions_pkey PRIMARY KEY (deduction_instance_id)
);

-- Table 2.28: Payroll_adjustments
CREATE TABLE payroll.payroll_adjustments (
    adjustment_id SERIAL,
    employee_id INTEGER,
    run_id INTEGER,
    payslip_id INTEGER,
    adjustment_type VARCHAR(50) NOT NULL,
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    is_taxable BOOLEAN NOT NULL,
    payment_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT payroll_adjustments_pkey PRIMARY KEY (adjustment_id)
);

-- Table 2.29: Leave_types
CREATE TABLE payroll.leave_types (
    type_id SERIAL,
    name VARCHAR(100) NOT NULL,
    is_paid BOOLEAN NOT NULL,
    CONSTRAINT leave_types_pkey PRIMARY KEY (type_id)
);

-- Table 2.30: Leave_entitlements
CREATE TABLE payroll.leave_entitlements (
    type_id INTEGER,
    job_id INTEGER,
    days_per_year INTEGER NOT NULL,
    accrual_rate_monthly DECIMAL(5,2),
    can_carry_over BOOLEAN NOT NULL,
    CONSTRAINT leave_entitlements_pkey PRIMARY KEY (type_id, job_id)
);

-- Table 2.31: Leave_requests
CREATE TABLE payroll.leave_requests (
    request_id SERIAL,
    employee_id INTEGER,
    type_id INTEGER,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    approved_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT leave_requests_pkey PRIMARY KEY (request_id)
);

-- Table 2.32: Expense_claims
CREATE TABLE payroll.expense_claims (
    claim_id SERIAL,
    employee_id INTEGER,
    payslip_id INTEGER,
    amount DECIMAL(12,2) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    receipt_path TEXT,
    status VARCHAR(20) NOT NULL,
    submitted_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT expense_claims_pkey PRIMARY KEY (claim_id)
);

-- Table 2.33: Claim_approvals
CREATE TABLE payroll.claim_approvals (
    approval_id SERIAL,
    claim_id INTEGER,
    approver_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT claim_approvals_pkey PRIMARY KEY (approval_id)
);

-- Table 2.34: Benefit_plans
CREATE TABLE payroll.benefit_plans (
    plan_id SERIAL,
    plan_name VARCHAR(100) NOT NULL,
    plan_type VARCHAR(50) NOT NULL,
    provider VARCHAR(200),
    description TEXT,
    start DATE,
    employee_contribution_rate DECIMAL(5,4),
    employer_contribution_rate DECIMAL(5,4),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT benefit_plans_pkey PRIMARY KEY (plan_id)
);

-- Table 2.35: Employee_benefits
CREATE TABLE payroll.employee_benefits (
    enrollment_id SERIAL,
    employee_id INTEGER,
    plan_id INTEGER,
    enrollment_date DATE NOT NULL,
    end_date DATE,
    employee_contribution DECIMAL(12,2),
    employer_contribution DECIMAL(12,2),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT employee_benefits_pkey PRIMARY KEY (enrollment_id)
);

-- Table 2.36: Job_titles
CREATE TABLE recruitment.job_titles (
    job_id SERIAL,
    title_name VARCHAR(100) NOT NULL,
    exam_type VARCHAR(50),
    job_row INTEGER,
    CONSTRAINT job_titles_pkey PRIMARY KEY (job_id)
);

-- Table 2.37: Vacancies
CREATE TABLE recruitment.vacancies (
    vacancy_id SERIAL,
    job_id INTEGER,
    status VARCHAR(20) NOT NULL,
    type VARCHAR(50),
    no_of_positions INTEGER,
    posted_date DATE,
    closing_date DATE,
    description TEXT,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT vacancies_pkey PRIMARY KEY (vacancy_id)
);

-- Table 2.38: Candidates
CREATE TABLE recruitment.candidates (
    candidate_id SERIAL,
    f_name VARCHAR(50) NOT NULL,
    l_name VARCHAR(50) NOT NULL,
    full_name VARCHAR(101) GENERATED ALWAYS AS (trim(f_name || ' ' || l_name)) STORED,
    email VARCHAR(100) UNIQUE,
    vacancy_id INTEGER,
    source VARCHAR(50),
    application_date DATE,
    cover_letter_path TEXT,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT candidates_pkey PRIMARY KEY (candidate_id)
);

-- Table 2.39: Recruitment_results
CREATE TABLE recruitment.recruitment_results (
    result_id SERIAL,
    candidate_id INTEGER,
    exam_score DECIMAL(5,2),
    interview_score DECIMAL(5,2),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT recruitment_results_pkey PRIMARY KEY (result_id)
);

-- Table 2.40: Candidate_phones
CREATE TABLE recruitment.candidate_phones (
    phone_id SERIAL,
    candidate_id INTEGER,
    phone_type VARCHAR(30) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    CONSTRAINT candidate_phones_pkey PRIMARY KEY (phone_id)
);

-- Table 2.41: Job_Training_requirements
CREATE TABLE recruitment.job_training_requirements (
    job_id INTEGER,
    training_id INTEGER,
    CONSTRAINT job_training_requirements_pkey PRIMARY KEY (job_id, training_id)
);

-- Table 2.42: Performance_plans
CREATE TABLE performance.performance_plans (
    plan_id SERIAL,
    employee_id INTEGER,
    year SMALLINT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    plan_status VARCHAR(20) NOT NULL,
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT performance_plans_pkey PRIMARY KEY (plan_id)
);

-- Table 2.43: Performance_goals
CREATE TABLE performance.performance_goals (
    goal_id SERIAL,
    plan_id INTEGER,
    goal_title VARCHAR(200) NOT NULL,
    description TEXT,
    target_value DECIMAL(10,2),
    actual_value DECIMAL(10,2),
    weight DECIMAL(5,2),
    status VARCHAR(20) NOT NULL,
    eval_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT performance_goals_pkey PRIMARY KEY (goal_id)
);

-- Table 2.44: Performance_review
CREATE TABLE performance.performance_review (
    review_id SERIAL,
    plan_id INTEGER,
    reviewer_id INTEGER,
    review_date DATE NOT NULL,
    reality_score DECIMAL(5,2),
    overall_rating DECIMAL(4,2),
    approval_status VARCHAR(20) NOT NULL,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT performance_review_pkey PRIMARY KEY (review_id)
);

-- Table 2.45: Trainings
CREATE TABLE training.trainings (
    training_id SERIAL,
    employee_id INTEGER,
    title VARCHAR(200) NOT NULL,
    type VARCHAR(50),
    provider VARCHAR(200),
    start_date DATE,
    end_date DATE,
    cost DECIMAL(10,2),
    location VARCHAR(100),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT trainings_pkey PRIMARY KEY (training_id)
);

-- Table 2.46: Training_evaluations
CREATE TABLE training.training_evaluations (
    eval_id SERIAL,
    training_id INTEGER,
    score DECIMAL(5,2),
    certificate_issued BOOLEAN DEFAULT false,
    certificate_expiry DATE,
    evaluated_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT training_evaluations_pkey PRIMARY KEY (eval_id)
);

-- Table 2.47: User_accounts
CREATE TABLE hr_auth.user_accounts (
    user_id SERIAL,
    employee_id INTEGER UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    last_login TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT user_accounts_pkey PRIMARY KEY (user_id)
);

-- Table 2.48: Roles
CREATE TABLE hr_auth.roles (
    role_id SERIAL,
    role_name VARCHAR(100) NOT NULL UNIQUE,
    CONSTRAINT roles_pkey PRIMARY KEY (role_id)
);

-- Table 2.49: Role_permissions
CREATE TABLE hr_auth.role_permissions (
    permission_id SERIAL,
    role_id INTEGER,
    permission_name VARCHAR(100) NOT NULL,
    CONSTRAINT role_permissions_pkey PRIMARY KEY (permission_id)
);

-- Table 2.50: Audit_logs
CREATE TABLE hr_auth.audit_logs (
    log_id SERIAL,
    user_id INTEGER,
    action_type VARCHAR(20) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    timestamp TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT audit_logs_pkey PRIMARY KEY (log_id)
);

-- Table 2.51: User_roles
CREATE TABLE hr_auth.user_roles (
    user_id INTEGER,
    role_id INTEGER,
    CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id)
);

-- Table 2.52: Documents (Polymorphic document store)
CREATE TABLE shared.documents (
    document_id SERIAL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50),
    description TEXT,
    uploaded_by INTEGER,
    upload_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT documents_pkey PRIMARY KEY (document_id)
);

ALTER TABLE org.employee ADD CONSTRAINT fk_employee_dept_id FOREIGN KEY (dept_id) REFERENCES org.departments (dept_id);
ALTER TABLE org.employee ADD CONSTRAINT fk_employee_job_id FOREIGN KEY (job_id) REFERENCES recruitment.job_titles (job_id);
ALTER TABLE org.employee ADD CONSTRAINT fk_employee_office_id FOREIGN KEY (office_id) REFERENCES org.offices (office_id);
ALTER TABLE org.employee ADD CONSTRAINT fk_employee_manager_id FOREIGN KEY (manager_id) REFERENCES org.employee (employee_id);
ALTER TABLE org.departments ADD CONSTRAINT fk_departments_office_id FOREIGN KEY (office_id) REFERENCES org.offices (office_id);
ALTER TABLE org.shifts ADD CONSTRAINT fk_shifts_department_id FOREIGN KEY (department_id) REFERENCES org.departments (dept_id);
ALTER TABLE org.emergency_contacts ADD CONSTRAINT fk_emergency_contacts_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE org.dependants ADD CONSTRAINT fk_dependants_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE org.attendance ADD CONSTRAINT fk_attendance_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE org.overtime_records ADD CONSTRAINT fk_overtime_records_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE org.overtime_records ADD CONSTRAINT fk_overtime_records_approved_by FOREIGN KEY (approved_by) REFERENCES org.employee (employee_id);
ALTER TABLE org.onboarding_checklists ADD CONSTRAINT fk_onboarding_checklists_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE org.onboarding_checklists ADD CONSTRAINT fk_onboarding_checklists_created_by FOREIGN KEY (created_by) REFERENCES org.employee (employee_id);
ALTER TABLE org.onboarding_tasks ADD CONSTRAINT fk_onboarding_tasks_checklist_id FOREIGN KEY (checklist_id) REFERENCES org.onboarding_checklists (checklist_id);
ALTER TABLE org.onboarding_tasks ADD CONSTRAINT fk_onboarding_tasks_completed_by FOREIGN KEY (completed_by) REFERENCES org.employee (employee_id);
ALTER TABLE org.employee_exits ADD CONSTRAINT fk_employee_exits_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE org.grievances ADD CONSTRAINT fk_grievances_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE org.grievances ADD CONSTRAINT fk_grievances_resolved_by FOREIGN KEY (resolved_by) REFERENCES org.employee (employee_id);
ALTER TABLE org.disciplinary_actions ADD CONSTRAINT fk_disciplinary_actions_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE org.disciplinary_actions ADD CONSTRAINT fk_disciplinary_actions_issued_by FOREIGN KEY (issued_by) REFERENCES org.employee (employee_id);
ALTER TABLE org.asset_assignments ADD CONSTRAINT fk_asset_assignments_asset_id FOREIGN KEY (asset_id) REFERENCES org.assets (asset_id);
ALTER TABLE org.asset_assignments ADD CONSTRAINT fk_asset_assignments_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE org.employee_shifts ADD CONSTRAINT fk_employee_shifts_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE org.employee_shifts ADD CONSTRAINT fk_employee_shifts_shift_id FOREIGN KEY (shift_id) REFERENCES org.shifts (shift_id);
ALTER TABLE org.employee_phones ADD CONSTRAINT fk_employee_phones_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE org.employee_addresses ADD CONSTRAINT fk_employee_addresses_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE people.promotions ADD CONSTRAINT fk_promotions_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE people.promotions ADD CONSTRAINT fk_promotions_old_job_id FOREIGN KEY (old_job_id) REFERENCES recruitment.job_titles (job_id);
ALTER TABLE people.promotions ADD CONSTRAINT fk_promotions_new_job_id FOREIGN KEY (new_job_id) REFERENCES recruitment.job_titles (job_id);
ALTER TABLE people.promotions ADD CONSTRAINT fk_promotions_old_matrix_id FOREIGN KEY (old_matrix_id) REFERENCES payroll.salary_matrix (matrix_id);
ALTER TABLE people.promotions ADD CONSTRAINT fk_promotions_new_matrix_id FOREIGN KEY (new_matrix_id) REFERENCES payroll.salary_matrix (matrix_id);
ALTER TABLE people.promotion_criteria_assessment ADD CONSTRAINT fk_promotion_criteria_assessment_promotion_id FOREIGN KEY (promotion_id) REFERENCES people.promotions (promotion_id);
ALTER TABLE people.promotion_criteria_assessment ADD CONSTRAINT fk_promotion_criteria_assessment_assessed_by FOREIGN KEY (assessed_by) REFERENCES org.employee (employee_id);
ALTER TABLE people.promotionapproval_log ADD CONSTRAINT fk_promotionapproval_log_promotion_id FOREIGN KEY (promotion_id) REFERENCES people.promotions (promotion_id);
ALTER TABLE people.promotionapproval_log ADD CONSTRAINT fk_promotionapproval_log_approver_id FOREIGN KEY (approver_id) REFERENCES org.employee (employee_id);
ALTER TABLE payroll.salary_contracts ADD CONSTRAINT fk_salary_contracts_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE payroll.salary_contracts ADD CONSTRAINT fk_salary_contracts_matrix_id FOREIGN KEY (matrix_id) REFERENCES payroll.salary_matrix (matrix_id);
ALTER TABLE payroll.salary_contracts ADD CONSTRAINT fk_salary_contracts_approved_by FOREIGN KEY (approved_by) REFERENCES org.employee (employee_id);
ALTER TABLE payroll.payroll_runs ADD CONSTRAINT fk_payroll_runs_run_by FOREIGN KEY (run_by) REFERENCES org.employee (employee_id);
ALTER TABLE payroll.payroll_runs ADD CONSTRAINT fk_payroll_runs_approved_by FOREIGN KEY (approved_by) REFERENCES org.employee (employee_id);
ALTER TABLE payroll.payslips ADD CONSTRAINT fk_payslips_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE payroll.payslips ADD CONSTRAINT fk_payslips_run_id FOREIGN KEY (run_id) REFERENCES payroll.payroll_runs (run_id);
ALTER TABLE payroll.employee_deductions ADD CONSTRAINT fk_employee_deductions_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE payroll.employee_deductions ADD CONSTRAINT fk_employee_deductions_payslip_id FOREIGN KEY (payslip_id) REFERENCES payroll.payslips (payslip_id);
ALTER TABLE payroll.payroll_adjustments ADD CONSTRAINT fk_payroll_adjustments_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE payroll.payroll_adjustments ADD CONSTRAINT fk_payroll_adjustments_run_id FOREIGN KEY (run_id) REFERENCES payroll.payroll_runs (run_id);
ALTER TABLE payroll.payroll_adjustments ADD CONSTRAINT fk_payroll_adjustments_payslip_id FOREIGN KEY (payslip_id) REFERENCES payroll.payslips (payslip_id);
ALTER TABLE payroll.leave_entitlements ADD CONSTRAINT fk_leave_entitlements_type_id FOREIGN KEY (type_id) REFERENCES payroll.leave_types (type_id);
ALTER TABLE payroll.leave_entitlements ADD CONSTRAINT fk_leave_entitlements_job_id FOREIGN KEY (job_id) REFERENCES recruitment.job_titles (job_id);
ALTER TABLE payroll.leave_requests ADD CONSTRAINT fk_leave_requests_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE payroll.leave_requests ADD CONSTRAINT fk_leave_requests_type_id FOREIGN KEY (type_id) REFERENCES payroll.leave_types (type_id);
ALTER TABLE payroll.leave_requests ADD CONSTRAINT fk_leave_requests_approved_by FOREIGN KEY (approved_by) REFERENCES org.employee (employee_id);
ALTER TABLE payroll.expense_claims ADD CONSTRAINT fk_expense_claims_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE payroll.expense_claims ADD CONSTRAINT fk_expense_claims_payslip_id FOREIGN KEY (payslip_id) REFERENCES payroll.payslips (payslip_id);
ALTER TABLE payroll.claim_approvals ADD CONSTRAINT fk_claim_approvals_claim_id FOREIGN KEY (claim_id) REFERENCES payroll.expense_claims (claim_id);
ALTER TABLE payroll.claim_approvals ADD CONSTRAINT fk_claim_approvals_approver_id FOREIGN KEY (approver_id) REFERENCES org.employee (employee_id);
ALTER TABLE payroll.employee_benefits ADD CONSTRAINT fk_employee_benefits_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE payroll.employee_benefits ADD CONSTRAINT fk_employee_benefits_plan_id FOREIGN KEY (plan_id) REFERENCES payroll.benefit_plans (plan_id);
ALTER TABLE recruitment.vacancies ADD CONSTRAINT fk_vacancies_job_id FOREIGN KEY (job_id) REFERENCES recruitment.job_titles (job_id);
ALTER TABLE recruitment.candidates ADD CONSTRAINT fk_candidates_vacancy_id FOREIGN KEY (vacancy_id) REFERENCES recruitment.vacancies (vacancy_id);
ALTER TABLE recruitment.recruitment_results ADD CONSTRAINT fk_recruitment_results_candidate_id FOREIGN KEY (candidate_id) REFERENCES recruitment.candidates (candidate_id);
ALTER TABLE recruitment.candidate_phones ADD CONSTRAINT fk_candidate_phones_candidate_id FOREIGN KEY (candidate_id) REFERENCES recruitment.candidates (candidate_id);
ALTER TABLE recruitment.job_training_requirements ADD CONSTRAINT fk_job_training_requirements_job_id FOREIGN KEY (job_id) REFERENCES recruitment.job_titles (job_id);
ALTER TABLE recruitment.job_training_requirements ADD CONSTRAINT fk_job_training_requirements_training_id FOREIGN KEY (training_id) REFERENCES training.trainings (training_id);
ALTER TABLE performance.performance_plans ADD CONSTRAINT fk_performance_plans_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE performance.performance_plans ADD CONSTRAINT fk_performance_plans_created_by FOREIGN KEY (created_by) REFERENCES org.employee (employee_id);
ALTER TABLE performance.performance_goals ADD CONSTRAINT fk_performance_goals_plan_id FOREIGN KEY (plan_id) REFERENCES performance.performance_plans (plan_id);
ALTER TABLE performance.performance_review ADD CONSTRAINT fk_performance_review_plan_id FOREIGN KEY (plan_id) REFERENCES performance.performance_plans (plan_id);
ALTER TABLE performance.performance_review ADD CONSTRAINT fk_performance_review_reviewer_id FOREIGN KEY (reviewer_id) REFERENCES org.employee (employee_id);
ALTER TABLE training.trainings ADD CONSTRAINT fk_trainings_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE training.training_evaluations ADD CONSTRAINT fk_training_evaluations_training_id FOREIGN KEY (training_id) REFERENCES training.trainings (training_id);
ALTER TABLE training.training_evaluations ADD CONSTRAINT fk_training_evaluations_evaluated_by FOREIGN KEY (evaluated_by) REFERENCES org.employee (employee_id);
ALTER TABLE hr_auth.user_accounts ADD CONSTRAINT fk_user_accounts_employee_id FOREIGN KEY (employee_id) REFERENCES org.employee (employee_id);
ALTER TABLE hr_auth.role_permissions ADD CONSTRAINT fk_role_permissions_role_id FOREIGN KEY (role_id) REFERENCES hr_auth.roles (role_id);
ALTER TABLE hr_auth.audit_logs ADD CONSTRAINT fk_audit_logs_user_id FOREIGN KEY (user_id) REFERENCES hr_auth.user_accounts (user_id);
ALTER TABLE hr_auth.user_roles ADD CONSTRAINT fk_user_roles_user_id FOREIGN KEY (user_id) REFERENCES hr_auth.user_accounts (user_id);
ALTER TABLE hr_auth.user_roles ADD CONSTRAINT fk_user_roles_role_id FOREIGN KEY (role_id) REFERENCES hr_auth.roles (role_id);
ALTER TABLE shared.documents ADD CONSTRAINT fk_documents_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES org.employee (employee_id);

CREATE INDEX idx_employee_dept_id ON org.employee (dept_id);
CREATE INDEX idx_employee_job_id ON org.employee (job_id);
CREATE INDEX idx_employee_office_id ON org.employee (office_id);
CREATE INDEX idx_employee_manager_id ON org.employee (manager_id);
CREATE INDEX idx_departments_office_id ON org.departments (office_id);
CREATE INDEX idx_shifts_department_id ON org.shifts (department_id);
CREATE INDEX idx_emergency_contacts_employee_id ON org.emergency_contacts (employee_id);
CREATE INDEX idx_dependants_employee_id ON org.dependants (employee_id);
CREATE INDEX idx_attendance_employee_id ON org.attendance (employee_id);
CREATE INDEX idx_overtime_records_employee_id ON org.overtime_records (employee_id);
CREATE INDEX idx_overtime_records_approved_by ON org.overtime_records (approved_by);
CREATE INDEX idx_onboarding_checklists_employee_id ON org.onboarding_checklists (employee_id);
CREATE INDEX idx_onboarding_checklists_created_by ON org.onboarding_checklists (created_by);
CREATE INDEX idx_onboarding_tasks_checklist_id ON org.onboarding_tasks (checklist_id);
CREATE INDEX idx_onboarding_tasks_completed_by ON org.onboarding_tasks (completed_by);
CREATE INDEX idx_employee_exits_employee_id ON org.employee_exits (employee_id);
CREATE INDEX idx_grievances_employee_id ON org.grievances (employee_id);
CREATE INDEX idx_grievances_resolved_by ON org.grievances (resolved_by);
CREATE INDEX idx_disciplinary_actions_employee_id ON org.disciplinary_actions (employee_id);
CREATE INDEX idx_disciplinary_actions_issued_by ON org.disciplinary_actions (issued_by);
CREATE INDEX idx_asset_assignments_asset_id ON org.asset_assignments (asset_id);
CREATE INDEX idx_asset_assignments_employee_id ON org.asset_assignments (employee_id);
CREATE INDEX idx_employee_shifts_employee_id ON org.employee_shifts (employee_id);
CREATE INDEX idx_employee_shifts_shift_id ON org.employee_shifts (shift_id);
CREATE INDEX idx_employee_phones_employee_id ON org.employee_phones (employee_id);
CREATE INDEX idx_employee_addresses_employee_id ON org.employee_addresses (employee_id);
CREATE INDEX idx_promotions_employee_id ON people.promotions (employee_id);
CREATE INDEX idx_promotions_old_job_id ON people.promotions (old_job_id);
CREATE INDEX idx_promotions_new_job_id ON people.promotions (new_job_id);
CREATE INDEX idx_promotions_old_matrix_id ON people.promotions (old_matrix_id);
CREATE INDEX idx_promotions_new_matrix_id ON people.promotions (new_matrix_id);
CREATE INDEX idx_promotion_criteria_assessment_promotion_id ON people.promotion_criteria_assessment (promotion_id);
CREATE INDEX idx_promotion_criteria_assessment_assessed_by ON people.promotion_criteria_assessment (assessed_by);
CREATE INDEX idx_promotionapproval_log_promotion_id ON people.promotionapproval_log (promotion_id);
CREATE INDEX idx_promotionapproval_log_approver_id ON people.promotionapproval_log (approver_id);
CREATE INDEX idx_salary_contracts_employee_id ON payroll.salary_contracts (employee_id);
CREATE INDEX idx_salary_contracts_matrix_id ON payroll.salary_contracts (matrix_id);
CREATE INDEX idx_salary_contracts_approved_by ON payroll.salary_contracts (approved_by);
CREATE INDEX idx_payroll_runs_run_by ON payroll.payroll_runs (run_by);
CREATE INDEX idx_payroll_runs_approved_by ON payroll.payroll_runs (approved_by);
CREATE INDEX idx_payslips_employee_id ON payroll.payslips (employee_id);
CREATE INDEX idx_payslips_run_id ON payroll.payslips (run_id);
CREATE INDEX idx_employee_deductions_employee_id ON payroll.employee_deductions (employee_id);
CREATE INDEX idx_employee_deductions_payslip_id ON payroll.employee_deductions (payslip_id);
CREATE INDEX idx_payroll_adjustments_employee_id ON payroll.payroll_adjustments (employee_id);
CREATE INDEX idx_payroll_adjustments_run_id ON payroll.payroll_adjustments (run_id);
CREATE INDEX idx_payroll_adjustments_payslip_id ON payroll.payroll_adjustments (payslip_id);
CREATE INDEX idx_leave_entitlements_type_id ON payroll.leave_entitlements (type_id);
CREATE INDEX idx_leave_entitlements_job_id ON payroll.leave_entitlements (job_id);
CREATE INDEX idx_leave_requests_employee_id ON payroll.leave_requests (employee_id);
CREATE INDEX idx_leave_requests_type_id ON payroll.leave_requests (type_id);
CREATE INDEX idx_leave_requests_approved_by ON payroll.leave_requests (approved_by);
CREATE INDEX idx_expense_claims_employee_id ON payroll.expense_claims (employee_id);
CREATE INDEX idx_expense_claims_payslip_id ON payroll.expense_claims (payslip_id);
CREATE INDEX idx_claim_approvals_claim_id ON payroll.claim_approvals (claim_id);
CREATE INDEX idx_claim_approvals_approver_id ON payroll.claim_approvals (approver_id);
CREATE INDEX idx_employee_benefits_employee_id ON payroll.employee_benefits (employee_id);
CREATE INDEX idx_employee_benefits_plan_id ON payroll.employee_benefits (plan_id);
CREATE INDEX idx_vacancies_job_id ON recruitment.vacancies (job_id);
CREATE INDEX idx_candidates_vacancy_id ON recruitment.candidates (vacancy_id);
CREATE INDEX idx_recruitment_results_candidate_id ON recruitment.recruitment_results (candidate_id);
CREATE INDEX idx_candidate_phones_candidate_id ON recruitment.candidate_phones (candidate_id);
CREATE INDEX idx_job_training_requirements_job_id ON recruitment.job_training_requirements (job_id);
CREATE INDEX idx_job_training_requirements_training_id ON recruitment.job_training_requirements (training_id);
CREATE INDEX idx_performance_plans_employee_id ON performance.performance_plans (employee_id);
CREATE INDEX idx_performance_plans_created_by ON performance.performance_plans (created_by);
CREATE INDEX idx_performance_goals_plan_id ON performance.performance_goals (plan_id);
CREATE INDEX idx_performance_review_plan_id ON performance.performance_review (plan_id);
CREATE INDEX idx_performance_review_reviewer_id ON performance.performance_review (reviewer_id);
CREATE INDEX idx_trainings_employee_id ON training.trainings (employee_id);
CREATE INDEX idx_training_evaluations_training_id ON training.training_evaluations (training_id);
CREATE INDEX idx_training_evaluations_evaluated_by ON training.training_evaluations (evaluated_by);
CREATE INDEX idx_user_accounts_employee_id ON hr_auth.user_accounts (employee_id);
CREATE INDEX idx_role_permissions_role_id ON hr_auth.role_permissions (role_id);
CREATE INDEX idx_audit_logs_user_id ON hr_auth.audit_logs (user_id);
CREATE INDEX idx_user_roles_user_id ON hr_auth.user_roles (user_id);
CREATE INDEX idx_user_roles_role_id ON hr_auth.user_roles (role_id);
CREATE INDEX idx_documents_uploaded_by ON shared.documents (uploaded_by);

-- Views for documented derived values.
CREATE OR REPLACE VIEW payroll.v_payslip_net AS
SELECT
    payslip_id,
    employee_id,
    run_id,
    gross_salary,
    tax_amount,
    pension_amount,
    (gross_salary - tax_amount - COALESCE(pension_amount, 0)) AS computed_net
FROM payroll.payslips;

CREATE OR REPLACE VIEW org.v_attendance_hours AS
SELECT
    attendance_id,
    employee_id,
    date,
    status,
    check_in,
    check_out,
    location_type,
    EXTRACT(EPOCH FROM (check_out - check_in)) / 3600.0 AS computed_total_hours
FROM org.attendance
WHERE check_in IS NOT NULL AND check_out IS NOT NULL;
