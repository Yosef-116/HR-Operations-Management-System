export type ApiResponse<T> = { success: boolean; data: T; meta?: { total: number; limit: number; offset: number; page: number } };

export type User = {
  user_id: number;
  employee_id: number | null;
  username: string;
  email: string | null;
  f_name: string | null;
  l_name: string | null;
  roles: string[];
  permissions: string[];
};

export type Employee = {
  employee_id: number;
  f_name: string;
  l_name: string;
  email: string;
  gender?: string | null;
  birth_date?: string | null;
  national_id?: string | null;
  nationality?: string | null;
  hire_date: string;
  employment_status: string;
  terminated_date?: string | null;
  dept_id: number | null;
  job_id: number | null;
  office_id?: number | null;
  manager_id?: number | null;
};

export type Department = { dept_id: number; dept_name: string };
export type JobTitle = { job_id: number; title_name: string; exam_type?: string | null; job_row?: number | null };
export type Office = { office_id: number; location_name: string; city: string | null };

export type EmergencyContact = {
  contact_id?: number;
  employee_id: number;
  name: string;
  phone: string;
};

export type EmployeePhone = {
  phone_id?: number;
  employee_id: number;
  phone_type: string;
  phone_number: string;
  is_primary?: boolean;
};

export type EmployeeAddress = {
  address_id?: number;
  employee_id: number;
  address_type: string;
  address_line: string;
  city: string | null;
  is_primary?: boolean;
};

export type AttendanceRecord = {
  attendance_id: number;
  employee_id: number;
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  total_hours: number | null;
  location_type: 'Office' | 'Remote' | string;
  created_at?: string;
  updated_at?: string;
};

export type LeaveType = {
  type_id: number;
  name: string;
  is_paid: boolean;
};

export type LeaveRequest = {
  request_id: number;
  employee_id: number;
  type_id: number;
  start_date: string;
  end_date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approved_by: number | null;
  created_at?: string;
  updated_at?: string;
};

export type ExpenseClaim = {
  claim_id: number;
  employee_id: number;
  payslip_id?: number | null;
  amount: number | string;
  category: string;
  description: string | null;
  receipt_path?: string | null;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Paid';
  submitted_date: string;
  created_at?: string;
  updated_at?: string;
};

export type LeaveBalanceItem = {
  type_id: number;
  type_name: string;
  is_paid: boolean;
  days_per_year: number;
  used_days: number;
  remaining_days: number;
  can_carry_over: boolean;
};

export type LeaveBalanceResponse = {
  employee_id: number;
  year: number;
  balances: LeaveBalanceItem[];
};

export type PayrollRun = {
  run_id: number;
  run_date: string;
  status: 'Draft' | 'Approved' | 'Processed';
  run_by: number | null;
  approved_by: number | null;
};

export type Payslip = {
  payslip_id: number;
  employee_id: number;
  run_id: number;
  gross_salary: number | string;
  tax_amount: number | string;
  pension_amount?: number | string | null;
  net_pay: number | string;
  created_at?: string;
};

export type SalaryContract = {
  contract_id: number;
  employee_id: number;
  matrix_id: number;
  contract_type: string;
  start_date: string;
  end_date?: string | null;
  probation_end_date?: string | null;
  is_active: boolean;
  approved_by?: number | null;
  signed_date?: string | null;
};

export type SalaryMatrix = {
  matrix_id: number;
  level: string;
  step: number;
  base_salary: number | string;
};

export type Asset = {
  asset_id: number;
  asset_name: string;
  asset_type: string;
  serial_number?: string | null;
  purchase_date?: string | null;
  condition?: string | null;
  status: 'Available' | 'Assigned' | 'Maintenance' | 'Retired';
  is_deleted?: boolean;
};

export type AssetAssignment = {
  assignment_id: number;
  asset_id: number;
  employee_id: number;
  assigned_date: string;
  returned_date?: string | null;
  condition_on_return?: string | null;
  created_at?: string;
  updated_at?: string | null;
};

export type OnboardingChecklist = {
  checklist_id: number;
  employee_id: number;
  created_by: number | null;
  status: 'In_Progress' | 'Completed';
  created_at?: string;
  updated_at?: string | null;
};

export type OnboardingTask = {
  task_id: number;
  checklist_id: number;
  task_name: string;
  due_date?: string | null;
  completed_by?: number | null;
  status: 'Pending' | 'Done';
  created_at?: string;
  updated_at?: string | null;
};

export type EmployeeExit = {
  exit_id: number;
  employee_id: number;
  exit_type: string;
  last_working_day: string;
  reason?: string | null;
  clearance_status: string;
  created_at?: string;
  updated_at?: string | null;
};

export type Grievance = {
  grievance_id: number;
  employee_id: number;
  submitted_date: string;
  category: string | null;
  description: string;
  status: 'Open' | 'Under Review' | 'Investigating' | 'Resolved' | 'Dismissed' | string;
  resolved_by?: number | null;
  resolution_date?: string | null;
  resolution_notes?: string | null;
  created_at?: string;
  updated_at?: string | null;
};

export type DepartmentAnalyticsRow = {
  dept_id: number;
  dept_name: string;
  office_name: string;
  total_headcount: number;
  active_headcount: number;
  monthly_payroll_commitment: number | null;
};

export type OfficeAnalyticsRow = {
  office_id: number;
  location_name: string;
  city: string;
  total_headcount: number;
  active_headcount: number;
};

export type LeaveReportRow = {
  type_name: string;
  is_paid: boolean;
  total_requests: number;
  approved_requests: number;
  pending_requests: number;
  rejected_requests: number;
  approved_days: number;
};

export type AssetReportRow = {
  asset_type: string;
  total_count: number;
  assigned_count: number;
  available_count: number;
  maintenance_count: number;
  retired_count: number;
};

export type PayrollRunReportRow = {
  run_id: number;
  run_date: string;
  status: string;
  payslip_count: number;
  total_gross: number;
  total_tax: number;
  total_pension: number;
  total_net: number;
};

export type ExpenseReportRow = {
  category: string;
  claim_count: number;
  total_amount: number;
  approved_amount: number;
  pending_amount: number;
};

export type ReportsOverview = {
  filters: { start_date: string | null; end_date: string | null };
  access: { includePayroll: boolean; includeGrievances: boolean };
  workforce: {
    total_employees: number;
    active_employees: number;
    on_leave_employees: number;
    exited_employees: number;
    new_hires: number;
    attrition_rate: number;
    demographics: { label: string; count: number }[];
    departments: DepartmentAnalyticsRow[];
    offices: OfficeAnalyticsRow[];
  };
  lifecycle: {
    exits: {
      total_exits: number;
      cleared_exits: number;
      pending_clearance: number;
      by_type: { exit_type: string; count: number }[];
    };
    onboarding: {
      total_checklists: number;
      in_progress_checklists: number;
      completed_checklists: number;
      total_tasks: number;
      completed_tasks: number;
      task_completion_rate: number;
    };
  };
  leave_and_attendance: {
    by_type: LeaveReportRow[];
    attendance_logs: number;
    avg_daily_hours: number;
    approved_overtime_hours: number;
  };
  assets: {
    by_type: AssetReportRow[];
  };
  payroll: {
    summary: {
      total_runs: number;
      finalized_runs: number;
      payslip_count: number;
      total_gross: number;
      total_tax: number;
      total_pension: number;
      total_net: number;
      avg_net_pay: number;
    };
    runs: PayrollRunReportRow[];
    expenses_by_category: ExpenseReportRow[];
  } | null;
  grievances: {
    total_cases: number;
    open_cases: number;
    active_cases: number;
    closed_cases: number;
    by_category: { category: string; count: number; closed_count: number }[];
  } | null;
};

export type Vacancy = {
  vacancy_id: number;
  job_id: number | null;
  status: 'Open' | 'Filled' | 'Closed' | 'Draft' | string;
  type?: string | null;
  no_of_positions?: number | null;
  posted_date?: string | null;
  closing_date?: string | null;
  description?: string | null;
  is_deleted?: boolean;
};

export type Candidate = {
  candidate_id: number;
  f_name: string;
  l_name: string;
  full_name?: string;
  email?: string | null;
  vacancy_id?: number | null;
  source?: string | null;
  application_date?: string | null;
  cover_letter_path?: string | null;
  is_deleted?: boolean;
  created_at?: string;
};

export type RecruitmentResult = {
  result_id: number;
  candidate_id: number;
  exam_score?: number | string | null;
  interview_score?: number | string | null;
  status: string;
  created_at?: string;
  updated_at?: string | null;
};

export type CandidatePhone = {
  phone_id: number;
  candidate_id: number;
  phone_type: string;
  phone_number: string;
  is_primary?: boolean;
};

export type PerformancePlan = {
  plan_id: number;
  employee_id: number;
  year: number;
  period_start: string;
  period_end: string;
  plan_status: 'Active' | 'In Progress' | 'Closed' | string;
  created_by?: number | null;
  created_at?: string;
  updated_at?: string | null;
};

export type PerformanceGoal = {
  goal_id: number;
  plan_id: number;
  goal_title: string;
  description?: string | null;
  target_value?: number | string | null;
  actual_value?: number | string | null;
  weight?: number | string | null;
  status: 'Pending' | 'In Progress' | 'Achieved' | 'Missed' | string;
  eval_date?: string | null;
  created_at?: string;
  updated_at?: string | null;
};

export type PerformanceReview = {
  review_id: number;
  plan_id: number;
  reviewer_id?: number | null;
  review_date: string;
  reality_score?: number | string | null;
  overall_rating?: number | string | null;
  approval_status: string;
  comments?: string | null;
  created_at?: string;
  updated_at?: string | null;
};

export type Promotion = {
  promotion_id: number;
  employee_id: number;
  old_job_id?: number | null;
  new_job_id?: number | null;
  old_matrix_id?: number | null;
  new_matrix_id?: number | null;
  promotion_type: string;
  effective_date: string;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  created_at?: string;
  updated_at?: string | null;
};

export type PromotionAssessment = {
  assessment_id: number;
  promotion_id: number;
  performance_review?: number | string | null;
  training_completed?: boolean;
  attendance_score?: number | string | null;
  yrs_in_role?: number | string | null;
  disciplinary_7?: boolean;
  overall_score?: number | string | null;
  assessment_date: string;
  assessed_by?: number | null;
};

export type PromotionApprovalLog = {
  log_id: number;
  promotion_id: number;
  approver_id?: number | null;
  action: 'Approved' | 'Rejected' | 'Returned' | string;
  notes?: string | null;
  action_date: string;
};

export type TrainingProgram = {
  training_id: number;
  employee_id: number | null;
  title: string;
  type?: string | null;
  provider?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  cost?: number | string | null;
  location?: string | null;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled' | string;
  created_at?: string;
  updated_at?: string | null;
};

export type TrainingEvaluation = {
  eval_id: number;
  training_id: number;
  score?: number | string | null;
  certificate_issued?: boolean;
  certificate_expiry?: string | null;
  evaluated_by?: number | null;
  created_at?: string;
};




