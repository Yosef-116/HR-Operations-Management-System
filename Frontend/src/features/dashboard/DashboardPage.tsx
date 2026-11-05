import { useEffect, useState } from 'react';
import { request } from '../../api';
import { useAuth } from '../../auth';
import { ActionCenter } from './ActionCenter';
import { AttendanceWidget } from './AttendanceWidget';
import { EmployeeSelfServiceHub } from './EmployeeSelfServiceHub';

type Totals = { employees: number; leave: number; expenses: number };

export function DashboardPage() {
  const { user } = useAuth();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState('');

  const isAdminOrManager = Boolean(
    user?.permissions.includes('manage_all') ||
    user?.permissions.includes('manage_org') ||
    user?.permissions.includes('manage_payroll') ||
    user?.permissions.includes('approve_leave') ||
    user?.permissions.includes('approve_expense')
  );

  useEffect(() => {
    let active = true;
    const queries = [
      request<unknown>('/data/org/employee?limit=1'),
      request<unknown>('/data/payroll/leave_requests?status=Pending&limit=1'),
      request<unknown>('/data/payroll/expense_claims?status=Pending&limit=1')
    ];
    Promise.all(queries).then(([employees, leave, expenses]) => {
      if (active) setTotals({ employees: employees.meta?.total ?? 0, leave: leave.meta?.total ?? 0, expenses: expenses.meta?.total ?? 0 });
    }).catch((cause: Error) => active && setError(cause.message));
    return () => { active = false; };
  }, []);

  return <>
    <section className="welcome" style={{ marginBottom: '1.25rem' }}>
      <h2>Hello, {user?.f_name ? `${user.f_name} ${user.l_name ?? ''}`.trim() : user?.username}</h2>
      <p style={{ margin: '.3rem 0 0' }}>Welcome to your WorkForce portal. Here is today's overview.</p>
    </section>

    {/* Attendance & Time Tracker Widget */}
    <AttendanceWidget />

    {error ? (
      <p className="form-error" role="alert">{error}</p>
    ) : (
      <div className="stats-grid">
        <Stat
          label={isAdminOrManager ? "Total Employees" : "My Profile Status"}
          value={isAdminOrManager ? totals?.employees : (user?.roles[0] || 'Active')}
          description={isAdminOrManager ? "Registered in company" : "Current account status"}
        />
        <Stat
          label={isAdminOrManager ? "Pending Leave Requests" : "My Pending Leaves"}
          value={totals?.leave}
          description="Awaiting approval"
        />
        <Stat
          label={isAdminOrManager ? "Pending Expense Claims" : "My Pending Claims"}
          value={totals?.expenses}
          description="Awaiting finance review"
        />
      </div>
    )}

    {/* Role-Specific Dashboard Hub */}
    {isAdminOrManager ? (
      <ActionCenter />
    ) : (
      <EmployeeSelfServiceHub />
    )}
  </>;
}

function Stat({ label, value, description }: { label: string; value: number | string | undefined; description: string }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
      <small>{value === undefined ? 'Loading…' : description}</small>
    </article>
  );
}
