import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { request } from '../../api';
import { useAuth } from '../../auth';
import type { Department, Employee, Grievance } from '../../types';

const GRIEVANCE_CATEGORIES = [
  'Workplace Harassment or Discrimination',
  'Compensation & Payroll Discrepancy',
  'Management & Supervision Concern',
  'Working Conditions & Safety',
  'Policy Violation or Ethics',
  'Interpersonal Conflict',
  'Schedule & Overtime Dispute',
  'Other'
] as const;

const GRIEVANCE_STATUSES = [
  'Open',
  'Under Review',
  'Investigating',
  'Resolved',
  'Dismissed'
] as const;

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? String(dateStr)
      : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Open':
      return 'badge badge-open';
    case 'Under Review':
    case 'Investigating':
      return 'badge badge-review';
    case 'Resolved':
      return 'badge badge-approved';
    case 'Dismissed':
      return 'badge badge-draft';
    default:
      return 'badge badge-pending';
  }
}

export function GrievancesPage() {
  const { user } = useAuth();

  const canResolve = useMemo(() => {
    if (!user) return false;
    if (user.roles?.includes('Admin') || user.permissions?.includes('manage_all')) return true;
    return user.permissions?.some((p) => ['resolve_grievance', 'manage_org', 'manage_all'].includes(p));
  }, [user]);

  const canFile = useMemo(() => {
    if (!user?.employee_id) return false;
    return Boolean(user.permissions?.includes('view_self') || canResolve);
  }, [user, canResolve]);

  const [activeTab, setActiveTab] = useState<'all-cases' | 'my-grievances'>(
    canResolve ? 'all-cases' : 'my-grievances'
  );

  // Sync active tab when user auth hydrates
  useEffect(() => {
    setActiveTab(canResolve ? 'all-cases' : 'my-grievances');
  }, [canResolve]);

  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [employees, setEmployees] = useState<Map<number, Employee>>(new Map());
  const [departments, setDepartments] = useState<Map<number, string>>(new Map());

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modals
  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Grievance | null>(null);

  // File Grievance Form
  const [fileForm, setFileForm] = useState({
    category: GRIEVANCE_CATEGORIES[0] as string,
    submitted_date: new Date().toISOString().slice(0, 10),
    description: ''
  });

  // Resolution Form
  const [resolutionForm, setResolutionForm] = useState({
    status: 'Under Review' as string,
    resolution_date: new Date().toISOString().slice(0, 10),
    resolution_notes: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const grievancesReq = request<Grievance[]>('/data/org/grievances?limit=500&sort=grievance_id&order=desc');

      if (canResolve) {
        const [grievRes, empRes, deptRes] = await Promise.all([
          grievancesReq,
          request<Employee[]>('/data/org/employee?limit=300').catch(() => ({ data: [] as Employee[] })),
          request<Department[]>('/data/org/departments?limit=100').catch(() => ({ data: [] as Department[] }))
        ]);

        setGrievances(grievRes.data || []);

        const empMap = new Map<number, Employee>();
        for (const e of empRes.data || []) empMap.set(e.employee_id, e);
        setEmployees(empMap);

        const deptMap = new Map<number, string>();
        for (const d of deptRes.data || []) deptMap.set(d.dept_id, d.dept_name);
        setDepartments(deptMap);
      } else {
        const grievRes = await grievancesReq;
        setGrievances(grievRes.data || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load grievance records');
    } finally {
      setLoading(false);
    }
  }, [canResolve]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCaseModal = (g: Grievance) => {
    setSelectedCase(g);
    setResolutionForm({
      status: g.status === 'Open' ? 'Under Review' : g.status,
      resolution_date: g.resolution_date ? g.resolution_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      resolution_notes: g.resolution_notes || ''
    });
    setError('');
  };

  const handleFileGrievance = async (e: FormEvent) => {
    e.preventDefault();
    if (!fileForm.description.trim()) {
      setError('Please provide a clear description of your concern.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await request('/workflows/grievances', {
        method: 'POST',
        body: JSON.stringify({
          category: fileForm.category,
          submitted_date: fileForm.submitted_date,
          description: fileForm.description.trim()
        })
      });
      setSuccess('Your grievance has been securely filed and logged for HR review.');
      setShowFileModal(false);
      setFileForm({
        category: GRIEVANCE_CATEGORIES[0],
        submitted_date: new Date().toISOString().slice(0, 10),
        description: ''
      });
      if (canResolve && activeTab === 'all-cases') {
        // Keep current tab; list refreshes with the new case
      }
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit grievance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCase = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    const isClosing = resolutionForm.status === 'Resolved' || resolutionForm.status === 'Dismissed';
    if (isClosing && !resolutionForm.resolution_notes.trim()) {
      setError('Please document the resolution summary or findings before closing this case.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await request<Grievance>(`/workflows/grievances/${selectedCase.grievance_id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          status: resolutionForm.status,
          resolution_date: isClosing ? resolutionForm.resolution_date : null,
          resolution_notes: resolutionForm.resolution_notes.trim() || null
        })
      });
      setSuccess(`Case #${selectedCase.grievance_id} updated to "${resolutionForm.status}".`);
      setSelectedCase(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update grievance status');
    } finally {
      setSubmitting(false);
    }
  };

  // Partition grievances by active tab
  const myGrievances = useMemo(() => {
    if (!user?.employee_id) return [];
    return grievances.filter((g) => g.employee_id === user.employee_id);
  }, [grievances, user?.employee_id]);

  const baseList = activeTab === 'all-cases' && canResolve ? grievances : myGrievances;

  const availableCategories = useMemo(() => {
    const set = new Set<string>(GRIEVANCE_CATEGORIES);
    for (const g of baseList) {
      if (g.category) set.add(g.category);
    }
    return Array.from(set);
  }, [baseList]);

  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return baseList.filter((g) => {
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && (g.category || 'Other') !== categoryFilter) return false;
      if (!q) return true;

      const emp = employees.get(g.employee_id);
      const empName = emp ? `${emp.f_name} ${emp.l_name} ${emp.email}`.toLowerCase() : '';
      return (
        String(g.grievance_id).includes(q) ||
        (g.category || '').toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        empName.includes(q)
      );
    });
  }, [baseList, statusFilter, categoryFilter, searchQuery, employees]);

  const stats = useMemo(() => {
    const total = baseList.length;
    const open = baseList.filter((g) => g.status === 'Open').length;
    const inReview = baseList.filter((g) => g.status === 'Under Review' || g.status === 'Investigating').length;
    const closed = baseList.filter((g) => g.status === 'Resolved' || g.status === 'Dismissed').length;
    return { total, open, inReview, closed };
  }, [baseList]);

  const getEmployeeLabel = (empId: number | null | undefined, fallbackPrefix = 'Employee') => {
    if (!empId) return '—';
    if (user?.employee_id === empId && user.f_name) {
      return `${user.f_name} ${user.l_name ?? ''}`.trim();
    }
    const emp = employees.get(empId);
    return emp ? `${emp.f_name} ${emp.l_name}`.trim() : `${fallbackPrefix} #${empId}`;
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="eyebrow">
            {canResolve && activeTab === 'all-cases' ? 'HR Compliance & Case Management' : 'Confidential Employee Support'}
          </span>
          <h1 style={{ margin: '0.2rem 0', fontSize: '1.8rem', fontWeight: 700 }}>
            {canResolve && activeTab === 'all-cases' ? 'Grievances & Workplace Resolutions' : 'My Grievances & Support Cases'}
          </h1>
          <p style={{ margin: 0, color: '#9898a8', fontSize: '0.9rem' }}>
            {canResolve && activeTab === 'all-cases'
              ? 'Triage workplace complaints, track active investigations, and document formal HR resolutions.'
              : 'Confidentially report workplace concerns, track investigation progress, and review official HR responses.'}
          </p>
        </div>

        {canFile && (
          <button
            type="button"
            className="button primary"
            onClick={() => { setShowFileModal(true); setError(''); setSuccess(''); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
          >
            + File New Grievance
          </button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 0, color: 'inherit', fontSize: '1.2rem' }}>×</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✅ {success}</span>
          <button type="button" onClick={() => setSuccess('')} style={{ background: 'none', border: 0, color: 'inherit', fontSize: '1.2rem' }}>×</button>
        </div>
      )}

      {/* Privacy & Confidentiality Banner (Self-Service View) */}
      {(!canResolve || activeTab === 'my-grievances') && (
        <div
          className="card"
          style={{
            padding: '1.15rem 1.4rem',
            background: 'linear-gradient(135deg, rgba(124,106,240,.13) 0%, rgba(22,22,26,.9) 100%)',
            border: '1px solid rgba(124,106,240,.28)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', maxWidth: '720px' }}>
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>🛡️</span>
            <div>
              <strong style={{ display: 'block', color: '#f0f0f2', marginBottom: '0.2rem' }}>
                Protected & Confidential Case Channel
              </strong>
              <span style={{ fontSize: '0.86rem', color: '#b7b7c6' }}>
                Submissions are strictly restricted to you and authorized HR / Grievance Resolution Officers. Every status update and resolution is audit-logged.
              </span>
            </div>
          </div>
          {!user?.employee_id && (
            <span className="badge badge-pending">Account not linked to an employee profile</span>
          )}
        </div>
      )}

      {/* KPI Metrics */}
      <div className="stats-grid" style={{ margin: 0 }}>
        <article className="stat-card">
          <span>{activeTab === 'all-cases' && canResolve ? 'Total Cases' : 'My Filed Cases'}</span>
          <strong>{stats.total}</strong>
          <small>All recorded submissions</small>
        </article>
        <article className="stat-card">
          <span>Open / Awaiting Triage</span>
          <strong style={{ color: '#ff9494' }}>{stats.open}</strong>
          <small>Pending initial HR review</small>
        </article>
        <article className="stat-card">
          <span>Active Investigation</span>
          <strong style={{ color: '#b7a9ff' }}>{stats.inReview}</strong>
          <small>Under review or investigating</small>
        </article>
        <article className="stat-card">
          <span>Resolved / Closed</span>
          <strong style={{ color: '#8fe3b6' }}>{stats.closed}</strong>
          <small>Formally closed with outcome</small>
        </article>
      </div>

      {/* Role Tabs for Resolvers */}
      {canResolve && (
        <div className="subnav-tabs" style={{ borderBottom: '1px solid #29292f', paddingBottom: '0.5rem' }}>
          <button
            type="button"
            className={`subnav-tab ${activeTab === 'all-cases' ? 'active' : ''}`}
            onClick={() => { setActiveTab('all-cases'); setStatusFilter('all'); setSearchQuery(''); }}
          >
            ⚖️ Resolution Desk ({grievances.length})
          </button>
          {user?.employee_id && (
            <button
              type="button"
              className={`subnav-tab ${activeTab === 'my-grievances' ? 'active' : ''}`}
              onClick={() => { setActiveTab('my-grievances'); setStatusFilter('all'); setSearchQuery(''); }}
            >
              👤 My Submissions ({myGrievances.length})
            </button>
          )}
        </div>
      )}

      {/* Main Table Card */}
      <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
        {/* Filter Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            <input
              type="text"
              placeholder={canResolve && activeTab === 'all-cases' ? 'Search case ID, employee, category, or details…' : 'Search case ID, category, or details…'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: '310px' }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 'auto', minWidth: '170px' }}
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              {GRIEVANCE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: 'auto', minWidth: '200px' }}
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <span style={{ fontSize: '0.85rem', color: '#9898a8' }}>
            Showing {filteredCases.length} of {baseList.length} case{baseList.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Table Content */}
        {loading ? (
          <p className="loading-cell">Loading grievance records…</p>
        ) : filteredCases.length === 0 ? (
          <div className="empty-state" style={{ padding: '3.5rem 1rem' }}>
            <h2>No grievance cases found</h2>
            <p style={{ color: '#9898a8', marginTop: '0.5rem' }}>
              {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'Try clearing or adjusting your search filters.'
                : activeTab === 'all-cases' && canResolve
                  ? 'No workplace grievances have been logged yet.'
                  : 'You have not submitted any workplace grievance cases.'}
            </p>
            {canFile && baseList.length === 0 && (
              <button
                type="button"
                className="button primary"
                onClick={() => setShowFileModal(true)}
                style={{ marginTop: '1rem' }}
              >
                + File First Grievance
              </button>
            )}
          </div>
        ) : (
          <div className="table-card" style={{ border: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Case</th>
                  {canResolve && activeTab === 'all-cases' && <th>Submitted By</th>}
                  <th>Category</th>
                  <th>Summary</th>
                  <th>Filed Date</th>
                  <th>Status</th>
                  <th>Resolution</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((g) => {
                  const emp = employees.get(g.employee_id);
                  const deptName = emp?.dept_id ? departments.get(emp.dept_id) : null;

                  return (
                    <tr
                      key={`griev-${g.grievance_id}`}
                      className="clickable-row"
                      onClick={() => openCaseModal(g)}
                    >
                      <td>
                        <strong>#{g.grievance_id}</strong>
                      </td>

                      {canResolve && activeTab === 'all-cases' && (
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#2d293e',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                color: '#c8c0ff',
                                flexShrink: 0
                              }}
                            >
                              {emp ? `${emp.f_name[0]}${emp.l_name[0]}` : `#${g.employee_id}`}
                            </div>
                            <div>
                              <strong>{getEmployeeLabel(g.employee_id)}</strong>
                              <small>{deptName || emp?.email || '—'}</small>
                            </div>
                          </div>
                        </td>
                      )}

                      <td>
                        <span className="badge-type">{g.category || 'Other'}</span>
                      </td>

                      <td style={{ maxWidth: '300px', whiteSpace: 'normal' }}>
                        <span
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            fontSize: '0.88rem',
                            color: '#e0e0ea'
                          }}
                        >
                          {g.description}
                        </span>
                      </td>

                      <td>{formatDate(g.submitted_date)}</td>

                      <td>
                        <span className={getStatusBadgeClass(g.status)}>{g.status}</span>
                      </td>

                      <td>
                        {g.resolution_date ? (
                          <div>
                            <strong>{formatDate(g.resolution_date)}</strong>
                            <small>By {getEmployeeLabel(g.resolved_by, 'HR Officer')}</small>
                          </div>
                        ) : g.resolved_by ? (
                          <div>
                            <small>Assigned to</small>
                            <strong>{getEmployeeLabel(g.resolved_by, 'HR Officer')}</strong>
                          </div>
                        ) : (
                          <span style={{ color: '#777781' }}>Pending review</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="button btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCaseModal(g);
                          }}
                        >
                          {canResolve && activeTab === 'all-cases' ? 'Review Case' : 'View Details'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MODAL 1: FILE NEW GRIEVANCE */}
      {showFileModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-heading">
              <h2>File Confidential Grievance</h2>
              <button
                type="button"
                onClick={() => setShowFileModal(false)}
                style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleFileGrievance} style={{ display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-error">⚠️ {error}</div>}
              <div
                style={{
                  background: 'rgba(124,106,240,.1)',
                  border: '1px solid rgba(124,106,240,.25)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 0.95rem',
                  fontSize: '0.84rem',
                  color: '#c8c0ff'
                }}
              >
                🛡️ Your report will be submitted securely under your employee profile and routed directly to authorized HR Grievance Officers.
              </div>

              <div className="form-grid">
                <label>
                  Concern Category *
                  <select
                    required
                    value={fileForm.category}
                    onChange={(e) => setFileForm((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    {GRIEVANCE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Incident / Filing Date *
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().slice(0, 10)}
                    value={fileForm.submitted_date}
                    onChange={(e) => setFileForm((prev) => ({ ...prev, submitted_date: e.target.value }))}
                  />
                </label>
              </div>

              <label>
                Detailed Description *
                <textarea
                  required
                  rows={5}
                  placeholder="Describe the incident or concern clearly—including dates, individuals or policies involved, any supporting context, and your desired resolution..."
                  value={fileForm.description}
                  onChange={(e) => setFileForm((prev) => ({ ...prev, description: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => setShowFileModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting…' : 'Submit Grievance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CASE DETAIL & RESOLUTION */}
      {selectedCase && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-heading" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0 }}>Case #{selectedCase.grievance_id}</h2>
                  <span className={getStatusBadgeClass(selectedCase.status)}>{selectedCase.status}</span>
                </div>
                <small style={{ color: '#9898a8', display: 'block', marginTop: '0.25rem' }}>
                  Filed on {formatDate(selectedCase.submitted_date)} · {selectedCase.category || 'Other'}
                </small>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gap: '1.15rem', marginTop: '1rem' }}>
              {error && <div className="alert alert-error">⚠️ {error}</div>}
              {/* Submitter & Handling Metadata */}
              <div className="info-grid" style={{ background: '#141418', padding: '0.9rem 1rem', borderRadius: '0.6rem', border: '1px solid #292932' }}>
                <div className="info-field">
                  <span className="info-label">Submitted By</span>
                  <span className="info-val">{getEmployeeLabel(selectedCase.employee_id)}</span>
                </div>
                <div className="info-field">
                  <span className="info-label">Case Handler / Reviewer</span>
                  <span className="info-val">
                    {selectedCase.resolved_by ? getEmployeeLabel(selectedCase.resolved_by, 'HR Officer') : 'Unassigned'}
                  </span>
                </div>
                <div className="info-field">
                  <span className="info-label">Filing Date</span>
                  <span className="info-val">{formatDate(selectedCase.submitted_date)}</span>
                </div>
                <div className="info-field">
                  <span className="info-label">Resolution Date</span>
                  <span className="info-val">{formatDate(selectedCase.resolution_date)}</span>
                </div>
              </div>

              {/* Description Body */}
              <div>
                <span className="eyebrow" style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                  Grievance Narrative
                </span>
                <div
                  style={{
                    background: '#141418',
                    border: '1px solid #292932',
                    borderRadius: '0.6rem',
                    padding: '1rem',
                    color: '#eaeaf2',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.92rem'
                  }}
                >
                  {selectedCase.description}
                </div>
              </div>

              {/* Official Resolution Notes (Read-Only display for employees or history) */}
              {(!canResolve || selectedCase.employee_id === user?.employee_id && activeTab === 'my-grievances') && (
                <div>
                  <span className="eyebrow" style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                    HR Investigation & Resolution Notes
                  </span>
                  <div
                    style={{
                      background: selectedCase.resolution_notes ? 'rgba(62,207,142,.06)' : '#141418',
                      border: `1px solid ${selectedCase.resolution_notes ? 'rgba(62,207,142,.22)' : '#292932'}`,
                      borderRadius: '0.6rem',
                      padding: '1rem',
                      color: selectedCase.resolution_notes ? '#d9f7e8' : '#888898',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.9rem'
                    }}
                  >
                    {selectedCase.resolution_notes || 'No formal resolution notes have been published yet. Your case is in our queue.'}
                  </div>
                </div>
              )}

              {/* HR Case Resolution Controls */}
              {canResolve && !(selectedCase.employee_id === user?.employee_id && activeTab === 'my-grievances') && (
                <form
                  onSubmit={handleUpdateCase}
                  style={{
                    background: '#141418',
                    border: '1px solid #30303c',
                    borderRadius: '0.65rem',
                    padding: '1.1rem',
                    display: 'grid',
                    gap: '0.9rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span className="eyebrow" style={{ color: '#c8c0ff', fontWeight: 700, fontSize: '0.78rem' }}>
                      HR Case Action & Resolution
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="button btn-sm"
                        onClick={() => setResolutionForm((prev) => ({ ...prev, status: 'Investigating' }))}
                      >
                        Investigate
                      </button>
                      <button
                        type="button"
                        className="button btn-sm"
                        style={{ borderColor: 'rgba(62,207,142,.4)', color: '#8fe3b6' }}
                        onClick={() => setResolutionForm((prev) => ({ ...prev, status: 'Resolved' }))}
                      >
                        Mark Resolved
                      </button>
                    </div>
                  </div>

                  <div className="form-grid">
                    <label>
                      Case Status
                      <select
                        value={resolutionForm.status}
                        onChange={(e) => setResolutionForm((prev) => ({ ...prev, status: e.target.value }))}
                      >
                        {GRIEVANCE_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Resolution Date
                      <input
                        type="date"
                        disabled={resolutionForm.status !== 'Resolved' && resolutionForm.status !== 'Dismissed'}
                        value={resolutionForm.resolution_date}
                        onChange={(e) => setResolutionForm((prev) => ({ ...prev, resolution_date: e.target.value }))}
                      />
                    </label>
                  </div>

                  <label>
                    Investigation Findings & Resolution Notes
                    <textarea
                      rows={4}
                      placeholder="Record interview outcomes, corrective actions taken, mediation summary, or justification..."
                      value={resolutionForm.resolution_notes}
                      onChange={(e) => setResolutionForm((prev) => ({ ...prev, resolution_notes: e.target.value }))}
                      style={{ resize: 'vertical' }}
                    />
                  </label>

                  <div className="modal-actions" style={{ marginTop: '0.35rem' }}>
                    <button
                      type="button"
                      className="button"
                      onClick={() => setSelectedCase(null)}
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="button primary"
                      disabled={submitting}
                    >
                      {submitting ? 'Saving Update…' : 'Update Case Record'}
                    </button>
                  </div>
                </form>
              )}

              {(!canResolve || (selectedCase.employee_id === user?.employee_id && activeTab === 'my-grievances')) && (
                <div className="modal-actions" style={{ marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => setSelectedCase(null)}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
