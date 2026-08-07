import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, request } from '../../api';
import { useAuth } from '../../auth';
import type { Department, Employee, JobTitle } from '../../types';

const statusClass = (status: string) => status.toLowerCase().replaceAll(' ', '-');

export function EmployeesPage() {
  const { user } = useAuth();
  const canManage = Boolean(user?.permissions.includes('manage_all') || user?.permissions.includes('manage_org'));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobs, setJobs] = useState<JobTitle[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadEmployees = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ limit: '15', page: String(page) });
      if (search.trim()) params.set('search', search.trim());
      const response = await request<Employee[]>(`/data/org/employee?${params}`);
      setEmployees(response.data); setTotal(response.meta?.total ?? 0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load employees'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { void loadEmployees(); }, [loadEmployees]);
  useEffect(() => {
    if (!canManage) return;
    Promise.all([request<Department[]>('/data/org/departments?limit=500'), request<JobTitle[]>('/data/recruitment/job_titles?limit=500')])
      .then(([departmentResponse, jobResponse]) => { setDepartments(departmentResponse.data); setJobs(jobResponse.data); })
      .catch(() => undefined);
  }, [canManage]);

  const names = {
    department: new Map(departments.map((department) => [department.dept_id, department.dept_name])),
    job: new Map(jobs.map((job) => [job.job_id, job.title_name]))
  };

  return <>
    <section className="toolbar"><div><p className="eyebrow">{total} employee{total === 1 ? '' : 's'}</p><input aria-label="Search employees" placeholder="Search employees" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
      {canManage && <button className="button primary" onClick={() => setShowForm(true)}>Add employee</button>}
    </section>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="card table-card"><table><thead><tr><th>Employee</th><th>Department</th><th>Job title</th><th>Status</th><th>Hired</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={5} className="loading-cell">Loading employees…</td></tr> : employees.length === 0 ? <tr><td colSpan={5} className="loading-cell">No employees found.</td></tr> : employees.map((employee) => <tr key={employee.employee_id}>
        <td><strong>{employee.f_name} {employee.l_name}</strong><small>{employee.email}</small></td>
        <td>{names.department.get(employee.dept_id ?? -1) ?? '—'}</td><td>{names.job.get(employee.job_id ?? -1) ?? '—'}</td>
        <td><span className={`status ${statusClass(employee.employment_status)}`}>{employee.employment_status}</span></td><td>{employee.hire_date?.slice(0, 10) ?? '—'}</td>
      </tr>)}</tbody></table></section>
    <div className="pagination"><button className="button" disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page}</span><button className="button" disabled={loading || employees.length < 15} onClick={() => setPage((value) => value + 1)}>Next</button></div>
    {showForm && <EmployeeForm departments={departments} jobs={jobs} onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); void loadEmployees(); }} />}
  </>;
}

function EmployeeForm({ departments, jobs, onClose, onCreated }: { departments: Department[]; jobs: JobTitle[]; onClose: () => void; onCreated: () => void }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const toNumber = (key: string) => form.get(key) ? Number(form.get(key)) : null;
    try {
      await request<Employee>('/data/org/employee', { method: 'POST', body: JSON.stringify({
        f_name: form.get('f_name'), l_name: form.get('l_name'), email: form.get('email'), hire_date: form.get('hire_date'),
        dept_id: toNumber('dept_id'), job_id: toNumber('job_id'), employment_status: 'Active'
      }) });
      onCreated();
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Could not create employee'); }
    finally { setSubmitting(false); }
  }

  return <div className="modal-backdrop" role="presentation"><form className="modal" onSubmit={submit}><div className="modal-heading"><h2>Add employee</h2><button className="button-link" type="button" onClick={onClose}>Close</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="form-grid">
      <label>First name<input name="f_name" required /></label><label>Last name<input name="l_name" required /></label>
      <label className="wide">Email<input name="email" type="email" required /></label><label>Hire date<input name="hire_date" type="date" required /></label>
      <label>Department<select name="dept_id"><option value="">Select department</option>{departments.map((department) => <option key={department.dept_id} value={department.dept_id}>{department.dept_name}</option>)}</select></label>
      <label>Job title<select name="job_id"><option value="">Select job title</option>{jobs.map((job) => <option key={job.job_id} value={job.job_id}>{job.title_name}</option>)}</select></label>
    </div><div className="modal-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create employee'}</button></div>
  </form></div>;
}
