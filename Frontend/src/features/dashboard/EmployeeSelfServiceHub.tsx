import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../../api';
import { useAuth } from '../../auth';
import type { ExpenseClaim, LeaveBalanceItem, LeaveBalanceResponse, LeaveRequest, LeaveType } from '../../types';

export function EmployeeSelfServiceHub() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<LeaveBalanceItem[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [myExpenses, setMyExpenses] = useState<ExpenseClaim[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.employee_id) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const [balRes, leavesRes, expensesRes, typesRes] = await Promise.all([
          request<LeaveBalanceResponse | LeaveBalanceItem>(`/workflows/employees/${user.employee_id}/leave-balance`).catch(() => null),
          request<LeaveRequest[]>('/data/payroll/leave_requests?limit=4').catch(() => ({ data: [] as LeaveRequest[] })),
          request<ExpenseClaim[]>('/data/payroll/expense_claims?limit=4').catch(() => ({ data: [] as ExpenseClaim[] })),
          request<LeaveType[]>('/data/payroll/leave_types?limit=50').catch(() => ({ data: [] as LeaveType[] }))
        ]);

        if (!active) return;

        if (balRes?.data) {
          if ('balances' in balRes.data && Array.isArray(balRes.data.balances)) {
            setBalances(balRes.data.balances);
          } else if ('remaining_days' in balRes.data) {
            setBalances([balRes.data as LeaveBalanceItem]);
          }
        }

        setMyLeaves(leavesRes.data || []);
        setMyExpenses(expensesRes.data || []);

        const typeMap = new Map<number, string>();
        for (const t of typesRes.data || []) {
          typeMap.set(t.type_id, t.name);
        }
        setLeaveTypes(typeMap);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();
    return () => { active = false; };
  }, [user?.employee_id]);

  return (
    <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1.5rem' }}>
      {/* Quick Actions Bar */}
      <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <span className="eyebrow">Quick Self-Service Actions</span>
        <div className="quick-actions-bar">
          <Link to="/leave" className="quick-action-btn primary">
            ✈ Request Time Off
          </Link>
          <Link to="/expenses" className="quick-action-btn">
            🧾 Submit Expense Claim
          </Link>
          <Link to="/payroll" className="quick-action-btn">
            💰 My Payslips
          </Link>
          <Link to="/employees" className="quick-action-btn">
            👥 Browse Directory
          </Link>
        </div>
      </section>

      {/* Leave Balances Cards */}
      {balances.length > 0 && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
            <span className="eyebrow">My Remaining Leave Days</span>
            <Link to="/leave" className="button-link" style={{ fontSize: '.8rem' }}>View leave details →</Link>
          </div>
          <div className="stats-grid" style={{ margin: 0 }}>
            {balances.slice(0, 3).map((bal) => (
              <article key={bal.type_id} className="stat-card">
                <span>{bal.type_name}</span>
                <strong>{bal.remaining_days} <small style={{ fontSize: '1rem', fontWeight: 'normal' }}>days</small></strong>
                <small>{bal.used_days} used this year</small>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Recent Submissions Feed */}
      <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>My Recent Submissions</h3>
          <span style={{ fontSize: '.8rem', color: '#9898a8' }}>Active requests status</span>
        </div>

        {loading ? (
          <p className="loading-cell">Loading activity…</p>
        ) : myLeaves.length === 0 && myExpenses.length === 0 ? (
          <p className="loading-cell">No recent requests submitted. Use the quick actions above to request leave or expenses.</p>
        ) : (
          <div className="table-card" style={{ border: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Details</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {myLeaves.map((l) => (
                  <tr key={`leave-${l.request_id}`}>
                    <td><span className="badge-type">Leave</span></td>
                    <td>
                      <strong>{leaveTypes.get(l.type_id) || 'Time Off'}</strong>
                      <small>{l.start_date.slice(0, 10)} to {l.end_date.slice(0, 10)}</small>
                    </td>
                    <td>{l.created_at ? new Date(l.created_at).toLocaleDateString() : l.start_date.slice(0, 10)}</td>
                    <td><span className={`status status-${l.status.toLowerCase()}`}>{l.status}</span></td>
                  </tr>
                ))}
                {myExpenses.map((exp) => (
                  <tr key={`exp-${exp.claim_id}`}>
                    <td><span className="badge-type" style={{ color: '#ffd27a', background: 'rgba(245,166,35,.12)' }}>Expense</span></td>
                    <td>
                      <strong>{exp.category}</strong>
                      <small style={{ color: '#8fe3b6' }}>${Number(exp.amount).toFixed(2)}</small>
                    </td>
                    <td>{exp.submitted_date.slice(0, 10)}</td>
                    <td><span className={`status status-${exp.status.toLowerCase()}`}>{exp.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

