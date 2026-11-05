import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, request } from '../../api';
import { useAuth } from '../../auth';
import type { Employee, ExpenseClaim } from '../../types';

const EXPENSE_CATEGORIES = [
  'Travel',
  'Meals & Subsistence',
  'Office Supplies',
  'Equipment & Hardware',
  'Transportation & Fuel',
  'Client Entertainment',
  'Training & Certification',
  'Other Business Expense'
] as const;

export function ExpensesPage() {
  const { user } = useAuth();
  const canApprove = Boolean(
    user?.permissions.includes('approve_expense') ||
    user?.permissions.includes('manage_payroll') ||
    user?.permissions.includes('manage_all')
  );
  const canPay = Boolean(
    user?.permissions.includes('manage_payroll') ||
    user?.permissions.includes('process_payroll') ||
    user?.permissions.includes('manage_all')
  );
  const canSubmit = Boolean(
    user?.permissions.includes('submit_expense') ||
    user?.permissions.includes('manage_all')
  );

  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [employees, setEmployees] = useState<Map<number, string>>(new Map());
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved' | 'Paid' | 'Rejected'>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams({ limit: '100' });
      if (filter !== 'All') queryParams.set('status', filter);

      const [claimsRes, empRes] = await Promise.all([
        request<ExpenseClaim[]>(`/data/payroll/expense_claims?${queryParams}`),
        request<Employee[]>('/data/org/employee?limit=200').catch(() => ({ data: [] as Employee[] }))
      ]);

      setClaims(claimsRes.data || []);

      const map = new Map<number, string>();
      for (const emp of empRes.data || []) {
        map.set(emp.employee_id, `${emp.f_name} ${emp.l_name}`.trim());
      }
      setEmployees(map);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load expense claims');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  async function handleAction(claimId: number, action: 'approve' | 'reject' | 'paid') {
    setActionId(claimId);
    setError('');
    try {
      if (action === 'paid') {
        await request(`/workflows/expense-claims/${claimId}/approve`, {
          method: 'POST',
          body: JSON.stringify({ status: 'Paid' })
        });
      } else {
        await request(`/workflows/expense-claims/${claimId}/${action}`, { method: 'POST' });
      }
      await loadClaims();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Failed to ${action} claim`);
    } finally {
      setActionId(null);
    }
  }

  // Calculate summary metrics
  const pendingClaims = claims.filter((c) => c.status === 'Pending');
  const pendingTotal = pendingClaims.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const approvedTotal = claims
    .filter((c) => c.status === 'Approved' || c.status === 'Paid')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt);
  };

  return (
    <>
      <section className="toolbar">
        <div>
          <p className="eyebrow">Expenses & Reimbursements</p>
          <div className="tab-group">
            {(['All', 'Pending', 'Approved', 'Paid', 'Rejected'] as const).map((tab) => (
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
        {canSubmit && (
          <button type="button" className="button primary" onClick={() => setShowModal(true)}>
            + Submit Expense Claim
          </button>
        )}
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {/* Overview Stats */}
      <section className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <article className="stat-card">
          <span>Pending Reimbursements</span>
          <strong>{formatCurrency(pendingTotal)}</strong>
          <small>{pendingClaims.length} claim{pendingClaims.length === 1 ? '' : 's'} awaiting review</small>
        </article>
        <article className="stat-card">
          <span>Approved & Paid Total</span>
          <strong>{formatCurrency(approvedTotal)}</strong>
          <small>Reimbursed or queued for payout</small>
        </article>
        <article className="stat-card">
          <span>Total Claims Count</span>
          <strong>{claims.length}</strong>
          <small>In current filter view</small>
        </article>
      </section>

      {/* Claims Table */}
      <section className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
              {(canApprove || canPay) && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canApprove || canPay ? 7 : 6} className="loading-cell">Loading expense claims…</td>
              </tr>
            ) : claims.length === 0 ? (
              <tr>
                <td colSpan={canApprove || canPay ? 7 : 6} className="loading-cell">No expense claims found.</td>
              </tr>
            ) : (
              claims.map((claim) => {
                const empName = employees.get(claim.employee_id) || (claim.employee_id === user?.employee_id ? 'You' : `Employee #${claim.employee_id}`);
                const isPending = claim.status === 'Pending';
                const isApproved = claim.status === 'Approved';

                return (
                  <tr key={claim.claim_id}>
                    <td>
                      <strong>{empName}</strong>
                      <small>{claim.receipt_path ? `Receipt: ${claim.receipt_path}` : 'No receipt'}</small>
                    </td>
                    <td><span className="badge-type">{claim.category || 'Expense'}</span></td>
                    <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal' }}>
                      {claim.description || '—'}
                    </td>
                    <td><strong style={{ color: '#8fe3b6' }}>{formatCurrency(Number(claim.amount))}</strong></td>
                    <td>{claim.submitted_date ? claim.submitted_date.slice(0, 10) : '—'}</td>
                    <td>
                      <span className={`status status-${claim.status.toLowerCase()}`}>
                        {claim.status}
                      </span>
                    </td>
                    {(canApprove || canPay) && (
                      <td>
                        {isPending && canApprove && (
                          <div style={{ display: 'flex', gap: '.4rem' }}>
                            <button
                              type="button"
                              className="button primary btn-sm"
                              disabled={actionId === claim.claim_id}
                              onClick={() => handleAction(claim.claim_id, 'approve')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="button btn-sm btn-danger"
                              disabled={actionId === claim.claim_id}
                              onClick={() => handleAction(claim.claim_id, 'reject')}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {isApproved && canPay && (
                          <button
                            type="button"
                            className="button primary btn-sm"
                            disabled={actionId === claim.claim_id}
                            onClick={() => handleAction(claim.claim_id, 'paid')}
                          >
                            Mark as Paid
                          </button>
                        )}
                        {!isPending && !isApproved && (
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
        <ExpenseClaimModal
          employeeId={user?.employee_id ?? 1}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            void loadClaims();
          }}
        />
      )}
    </>
  );
}

function ExpenseClaimModal({
  employeeId,
  onClose,
  onSuccess
}: {
  employeeId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [receiptRef, setReceiptRef] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid expense amount greater than 0.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await request('/data/payroll/expense_claims', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: employeeId,
          category,
          amount: parsedAmount,
          description: description.trim() || null,
          receipt_path: receiptRef.trim() || null,
          submitted_date: date,
          status: 'Pending'
        })
      });
      onSuccess();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not submit expense claim');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={submit}>
        <div className="modal-heading">
          <h2>Submit Expense Claim</h2>
          <button type="button" className="button-link" onClick={onClose}>Close</button>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="form-grid">
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </label>

          <label>
            Amount ($)
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>

          <label>
            Date Incurred
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>

          <label>
            Receipt Ref / Invoice #
            <input
              type="text"
              placeholder="e.g. INV-10492"
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
            />
          </label>

          <label className="wide">
            Description & Business Purpose
            <textarea
              rows={3}
              placeholder="Explain the business reason for this expense..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '.65rem .75rem',
                color: '#f0f0f2',
                background: '#202025',
                border: '1px solid #393941',
                borderRadius: '.5rem',
                fontFamily: 'inherit',
                fontSize: '.9rem',
                boxSizing: 'border-box'
              }}
              required
            />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="button primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Claim'}
          </button>
        </div>
      </form>
    </div>
  );
}

