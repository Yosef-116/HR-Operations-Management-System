import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../../api';
import type { Employee, ExpenseClaim, LeaveRequest, LeaveType } from '../../types';

export function ActionCenter() {
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<ExpenseClaim[]>([]);
  const [employees, setEmployees] = useState<Map<number, string>>(new Map());
  const [leaveTypes, setLeaveTypes] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'leave' | 'expenses'>('all');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leavesRes, expensesRes, empRes, typesRes] = await Promise.all([
        request<LeaveRequest[]>('/data/payroll/leave_requests?status=Pending&limit=10'),
        request<ExpenseClaim[]>('/data/payroll/expense_claims?status=Pending&limit=10'),
        request<Employee[]>('/data/org/employee?limit=200').catch(() => ({ data: [] as Employee[] })),
        request<LeaveType[]>('/data/payroll/leave_types?limit=50').catch(() => ({ data: [] as LeaveType[] }))
      ]);

      setPendingLeaves(leavesRes.data || []);
      setPendingExpenses(expensesRes.data || []);

      const empMap = new Map<number, string>();
      for (const e of empRes.data || []) {
        empMap.set(e.employee_id, `${e.f_name} ${e.l_name}`.trim());
      }
      setEmployees(empMap);

      const typeMap = new Map<number, string>();
      for (const t of typesRes.data || []) {
        typeMap.set(t.type_id, t.name);
      }
      setLeaveTypes(typeMap);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load pending approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleLeaveAction = async (id: number, action: 'approve' | 'reject') => {
    setActionId(`leave-${id}`);
    try {
      await request(`/workflows/leave-requests/${id}/${action}`, { method: 'POST' });
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Failed to ${action} leave`);
    } finally {
      setActionId(null);
    }
  };

  const handleExpenseAction = async (id: number, action: 'approve' | 'reject') => {
    setActionId(`expense-${id}`);
    try {
      await request(`/workflows/expense-claims/${id}/${action}`, { method: 'POST' });
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Failed to ${action} expense`);
    } finally {
      setActionId(null);
    }
  };

  const totalPending = pendingLeaves.length + pendingExpenses.length;

  const showLeaves = tab === 'all' || tab === 'leave';
  const showExpenses = tab === 'all' || tab === 'expenses';

  return (
    <section className="card action-center-card" style={{ marginTop: '1.5rem' }}>
      <div className="action-center-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Approvals Action Center</h3>
          {totalPending > 0 ? (
            <span className="action-badge">{totalPending} awaiting review</span>
          ) : (
            <span className="status status-approved">All caught up ✓</span>
          )}
        </div>

        <div className="tab-group" style={{ margin: 0 }}>
          <button
            type="button"
            className={`tab-btn${tab === 'all' ? ' active' : ''}`}
            onClick={() => setTab('all')}
          >
            All ({totalPending})
          </button>
          <button
            type="button"
            className={`tab-btn${tab === 'leave' ? ' active' : ''}`}
            onClick={() => setTab('leave')}
          >
            Leave ({pendingLeaves.length})
          </button>
          <button
            type="button"
            className={`tab-btn${tab === 'expenses' ? ' active' : ''}`}
            onClick={() => setTab('expenses')}
          >
            Expenses ({pendingExpenses.length})
          </button>
        </div>
      </div>

      {error && <p className="form-error" style={{ marginBottom: '1rem' }} role="alert">{error}</p>}

      {loading ? (
        <p className="loading-cell">Checking for pending items…</p>
      ) : totalPending === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#9898a8' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '.5rem' }}>🎉</span>
          <strong style={{ color: '#f0f0f2', fontSize: '1rem' }}>No pending approvals</strong>
          <p style={{ margin: '.35rem 0 0', fontSize: '.85rem' }}>All leave requests and expense claims have been processed.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {/* Pending Leaves */}
          {showLeaves && pendingLeaves.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                <span className="eyebrow" style={{ color: '#c8c0ff' }}>Leave Requests Awaiting Approval</span>
                <Link to="/leave" className="button-link" style={{ fontSize: '.8rem' }}>View all in Leave →</Link>
              </div>
              <div className="table-card" style={{ border: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Leave Type</th>
                      <th>Dates</th>
                      <th>Submitted</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingLeaves.map((req) => (
                      <tr key={req.request_id}>
                        <td><strong>{employees.get(req.employee_id) || `Employee #${req.employee_id}`}</strong></td>
                        <td><span className="badge-type">{leaveTypes.get(req.type_id) || `Type #${req.type_id}`}</span></td>
                        <td>{req.start_date.slice(0, 10)} to {req.end_date.slice(0, 10)}</td>
                        <td><small>{req.created_at ? new Date(req.created_at).toLocaleDateString() : '—'}</small></td>
                        <td>
                          <div style={{ display: 'flex', gap: '.4rem' }}>
                            <button
                              type="button"
                              className="button primary btn-sm"
                              disabled={actionId === `leave-${req.request_id}`}
                              onClick={() => handleLeaveAction(req.request_id, 'approve')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="button btn-sm btn-danger"
                              disabled={actionId === `leave-${req.request_id}`}
                              onClick={() => handleLeaveAction(req.request_id, 'reject')}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pending Expenses */}
          {showExpenses && pendingExpenses.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                <span className="eyebrow" style={{ color: '#ffd27a' }}>Expense Claims Awaiting Review</span>
                <Link to="/expenses" className="button-link" style={{ fontSize: '.8rem' }}>View all in Expenses →</Link>
              </div>
              <div className="table-card" style={{ border: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingExpenses.map((claim) => (
                      <tr key={claim.claim_id}>
                        <td><strong>{employees.get(claim.employee_id) || `Employee #${claim.employee_id}`}</strong></td>
                        <td><span className="badge-type">{claim.category}</span></td>
                        <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {claim.description || '—'}
                        </td>
                        <td><strong style={{ color: '#8fe3b6' }}>${Number(claim.amount).toFixed(2)}</strong></td>
                        <td>{claim.submitted_date.slice(0, 10)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '.4rem' }}>
                            <button
                              type="button"
                              className="button primary btn-sm"
                              disabled={actionId === `expense-${claim.claim_id}`}
                              onClick={() => handleExpenseAction(claim.claim_id, 'approve')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="button btn-sm btn-danger"
                              disabled={actionId === `expense-${claim.claim_id}`}
                              onClick={() => handleExpenseAction(claim.claim_id, 'reject')}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

