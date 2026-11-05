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
export type JobTitle = { job_id: number; title_name: string };
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
