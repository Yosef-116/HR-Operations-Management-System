import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, request } from '../../api';
import { useAuth } from '../../auth';
import type { Employee, LeaveBalanceItem, LeaveBalanceResponse, LeaveRequest, LeaveType } from '../../types';

export function LeavePage() {
  const { user } = useAuth();
  const canApprove = Boolean(
    user?.permissions.includes('approve_leave') ||
    user?.permissions.includes('manage_payroll') ||
    user?.permissions.includes('manage_all')
  );
  const canRequest = Boolean(
    user?.permissions.includes('request_leave') ||
    user?.permissions.includes('manage_all')
  );

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [employees, setEmployees] = useState<Map<number, string>>(new Map());
  const [balances, setBalances] = useState<LeaveBalanceItem[]>([]);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams({ limit: '100' });
      if (filter !== 'All') queryParams.set('status', filter);

      const [requestsRes, typesRes] = await Promise.all([
        request<LeaveRequest[]>(`/data/payroll/leave_requests?${queryParams}`),
        request<LeaveType[]>('/data/payroll/leave_types?limit=50').catch(() => ({ data: [] as LeaveType[] }))
      ]);

      setRequests(requestsRes.data || []);
      setTypes(typesRes.data || []);

      // If user has employee_id, load leave balance
      if (user?.employee_id) {
        try {
          const balRes = await request<LeaveBalanceResponse | LeaveBalanceItem>(`/workflows/employees/${user.employee_id}/leave-balance`);
          if (balRes.data) {
            if ('balances' in balRes.data && Array.isArray(balRes.data.balances)) {
              setBalances(balRes.data.balances);
            } else if ('remaining_days' in balRes.data) {
              setBalances([balRes.data as LeaveBalanceItem]);
            }
          }
        } catch {
          // Non-critical if balance endpoint fails
        }
      }

      // Load employees for name lookup
      try {
        const empRes = await request<Employee[]>('/data/org/employee?limit=200');
        const map = new Map<number, string>();
        for (const emp of empRes.data || []) {
          map.set(emp.employee_id, `${emp.f_name} ${emp.l_name}`.trim());
        }
        setEmployees(map);
      } catch {
        // Ignored
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load leave requests');
    } finally {
      setLoading(false);
    }
  }, [filter, user?.employee_id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const typeMap = new Map(types.map((t) => [t.type_id, t.name]));

  async function handleAction(requestId: number, action: 'approve' | 'reject') {
    setActionId(requestId);
    setError('');
    try {
      await request(`/workflows/leave-requests/${requestId}/${action}`, { method: 'POST' });
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Failed to ${action} leave request`);
    } finally {
      setActionId(null);
    }
  }

  const calculateDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  return (
    <>
      <section className="toolbar">
        <div>
          <p className="eyebrow">Leave & Time Off</p>
          <div className="tab-group">
            {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`tab-btn${filter === tab ? ' active' : ''}`}
                onClick={() => setFilter(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        {canRequest && (
          <button type="button" className="button primary" onClick={() => setShowModal(true)}>
            + Request Time Off
          </button>
        )}
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {/* Balance Summary Cards */}
      {balances.length > 0 && (
        <section className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          {balances.slice(0, 3).map((bal) => (
            <article key={bal.type_id} className="stat-card">
              <span>{bal.type_name}</span>
              <strong>{bal.remaining_days} <small style={{ fontSize: '1rem', fontWeight: 'normal' }}>days left</small></strong>
              <small>{bal.used_days} used of {bal.days_per_year} annual days</small>
            </article>
          ))}
        </section>
      )}

      {/* Requests Table */}
      <section className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave Type</th>
              <th>Dates</th>
              <th>Duration</th>
              <th>Status</th>
              {canApprove && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canApprove ? 6 : 5} className="loading-cell">Loading leave requests…</td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={canApprove ? 6 : 5} className="loading-cell">No leave requests found.</td>
              </tr>
            ) : (
              requests.map((req) => {
                const days = calculateDays(req.start_date, req.end_date);
                const empName = employees.get(req.employee_id) || (req.employee_id === user?.employee_id ? 'You' : `Employee #${req.employee_id}`);
                const typeName = typeMap.get(req.type_id) || `Type #${req.type_id}`;
                const isPending = req.status === 'Pending';

                return (
                  <tr key={req.request_id}>
                    <td>
                      <strong>{empName}</strong>
                      <small>{req.created_at ? new Date(req.created_at).toLocaleDateString() : ''}</small>
                    </td>
                    <td><span className="badge-type">{typeName}</span></td>
                    <td>
                      <span>{req.start_date.slice(0, 10)}</span>
                      <small style={{ color: '#9898a8' }}> to </small>
                      <span>{req.end_date.slice(0, 10)}</span>
                    </td>
                    <td><strong>{days} day{days === 1 ? '' : 's'}</strong></td>
                    <td>
                      <span className={`status status-${req.status.toLowerCase()}`}>
                        {req.status}
                      </span>
                    </td>
                    {canApprove && (
                      <td>
                        {isPending ? (
                          <div style={{ display: 'flex', gap: '.4rem' }}>
                            <button
                              type="button"
                              className="button primary btn-sm"
                              disabled={actionId === req.request_id}
                              onClick={() => handleAction(req.request_id, 'approve')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="button btn-sm btn-danger"
                              disabled={actionId === req.request_id}
                              onClick={() => handleAction(req.request_id, 'reject')}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <small style={{ color: '#777781' }}>Completed</small>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {showModal && (
        <LeaveRequestModal
          types={types}
          employeeId={user?.employee_id ?? 1}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            void loadData();
          }}
        />
      )}
    </>
  );
}

function LeaveRequestModal({
  types,
  employeeId,
  onClose,
  onSuccess
}: {
  types: LeaveType[];
  employeeId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [typeId, setTypeId] = useState<string>(types[0]?.type_id ? String(types[0].type_id) : '');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const calculateDays = () => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!typeId) {
      setError('Please select a leave type.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await request('/data/payroll/leave_requests', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: employeeId,
          type_id: Number(typeId),
          start_date: startDate,
          end_date: endDate,
          status: 'Pending'
        })
      });
      onSuccess();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not submit leave request');
    } finally {
      setSubmitting(false);
    }
  }

  const requestedDays = calculateDays();

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={submit}>
        <div className="modal-heading">
          <h2>Request Time Off</h2>
          <button type="button" className="button-link" onClick={onClose}>Close</button>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="form-grid">
          <label className="wide">
            Leave Type
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              required
            >
              {types.length === 0 && <option value="1">Annual Leave</option>}
              {types.map((t) => (
                <option key={t.type_id} value={t.type_id}>
                  {t.name} {t.is_paid ? '(Paid)' : '(Unpaid)'}
                </option>
              ))}
            </select>
          </label>

          <label>
            Start Date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>

          <label>
            End Date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </label>
        </div>

        <div style={{ marginTop: '1rem', padding: '.75rem', background: '#202025', borderRadius: '.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#9898a8', fontSize: '.85rem' }}>Total time requested:</span>
          <strong style={{ color: '#8fe3b6', fontSize: '1.1rem' }}>{requestedDays} day{requestedDays === 1 ? '' : 's'}</strong>
        </div>

        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="button primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
}

