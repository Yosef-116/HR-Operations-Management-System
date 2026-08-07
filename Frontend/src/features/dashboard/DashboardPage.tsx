import { useEffect, useState } from 'react';
import { request } from '../../api';
import { useAuth } from '../../auth';

type Totals = { employees: number; leave: number; expenses: number };

export function DashboardPage() {
  const { user } = useAuth();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState('');

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
    <section className="welcome"><h2>Hello, {user?.f_name ?? user?.username}</h2><p>Here is the current HR operations overview.</p></section>
    {error ? <p className="form-error">{error}</p> : <div className="stats-grid">
      <Stat label="Employees" value={totals?.employees} />
      <Stat label="Pending leave" value={totals?.leave} />
      <Stat label="Pending expenses" value={totals?.expenses} />
    </div>}
    <section className="card"><h2>Migration status</h2><p>Dashboard and employee management use React. The remaining modules stay available in the legacy dashboard until each feature is migrated and verified.</p></section>
  </>;
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return <article className="stat-card"><span>{label}</span><strong>{value ?? '—'}</strong><small>{value === undefined ? 'Loading…' : 'Current records'}</small></article>;
}
