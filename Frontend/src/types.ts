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
  dept_id: number | null;
  job_id: number | null;
  hire_date: string;
  employment_status: string;
};

export type Department = { dept_id: number; dept_name: string };
export type JobTitle = { job_id: number; title_name: string };
