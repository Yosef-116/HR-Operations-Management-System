import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { request } from '../../api';
import { useAuth } from '../../auth';
import type { Employee, TrainingEvaluation, TrainingProgram } from '../../types';

const TRAINING_TYPES = ['Technical', 'Leadership', 'Compliance & Ethics', 'Safety', 'Certification', 'Onboarding Workshop'] as const;
const TRAINING_STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'] as const;

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

function getTrainingBadge(status: string): string {
  switch (status) {
    case 'Completed':
      return 'badge badge-approved';
    case 'In Progress':
      return 'badge badge-review';
    case 'Cancelled':
      return 'badge badge-open';
    default:
      return 'badge badge-pending';
  }
}

export function TrainingPage() {
  const { user } = useAuth();

  const canManageTraining = useMemo(() => {
    if (!user) return false;
    if (user.roles?.includes('Admin') || user.permissions?.includes('manage_all')) return true;
    return Boolean(user.permissions?.includes('manage_training'));
  }, [user]);

  const [activeTab, setActiveTab] = useState<'programs' | 'certificates' | 'my-training'>(
    canManageTraining ? 'programs' : 'my-training'
  );

  useEffect(() => {
    setActiveTab(canManageTraining ? 'programs' : 'my-training');
  }, [canManageTraining]);

  const [trainings, setTrainings] = useState<TrainingProgram[]>([]);
  const [evaluations, setEvaluations] = useState<TrainingEvaluation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [evalTarget, setEvalTarget] = useState<TrainingProgram | null>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    employee_id: '',
    title: '',
    type: TRAINING_TYPES[0] as string,
    provider: '',
    location: 'Online / Virtual',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    cost: '',
    status: 'Scheduled'
  });

  const [evalForm, setEvalForm] = useState({
    score: '90',
    certificate_issued: true,
    certificate_expiry: '',
    training_status: 'Completed'
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (canManageTraining) {
        const [trainRes, evalRes, empRes] = await Promise.all([
          request<TrainingProgram[]>('/data/training/trainings?limit=500&sort=training_id&order=desc'),
          request<TrainingEvaluation[]>('/data/training/training_evaluations?limit=500').catch(() => ({ data: [] as TrainingEvaluation[] })),
          request<Employee[]>('/data/org/employee?limit=300').catch(() => ({ data: [] as Employee[] }))
        ]);
        setTrainings(trainRes.data || []);
        setEvaluations(evalRes.data || []);
        setEmployees(empRes.data || []);
      } else {
        const trainRes = await request<TrainingProgram[]>('/data/training/trainings?limit=200&sort=training_id&order=desc');
        setTrainings(trainRes.data || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load training records');
    } finally {
      setLoading(false);
    }
  }, [canManageTraining]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const empMap = useMemo(() => new Map(employees.map((e) => [e.employee_id, e])), [employees]);
  const trainingMap = useMemo(() => new Map(trainings.map((t) => [t.training_id, t])), [trainings]);

  const evalByTraining = useMemo(() => {
    const map = new Map<number, TrainingEvaluation>();
    for (const ev of evaluations) map.set(ev.training_id, ev);
    return map;
  }, [evaluations]);

  const myTrainings = useMemo(() => {
    if (!user?.employee_id) return trainings;
    return trainings.filter((t) => t.employee_id === user.employee_id);
  }, [trainings, user?.employee_id]);

  const activeList = canManageTraining && activeTab !== 'my-training' ? trainings : myTrainings;

  const stats = useMemo(() => {
    const total = activeList.length;
    const ongoing = activeList.filter((t) => t.status === 'Scheduled' || t.status === 'In Progress').length;
    const completed = activeList.filter((t) => t.status === 'Completed').length;
    const totalCost = activeList.reduce((sum, t) => sum + Number(t.cost || 0), 0);
    const certsIssued = evaluations.filter((e) => e.certificate_issued).length;
    return { total, ongoing, completed, totalCost, certsIssued };
  }, [activeList, evaluations]);

  const handleCreateTraining = async (e: FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await request('/data/training/trainings', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: createForm.employee_id ? Number(createForm.employee_id) : null,
          title: createForm.title.trim(),
          type: createForm.type,
          provider: createForm.provider.trim() || null,
          location: createForm.location.trim() || null,
          start_date: createForm.start_date || null,
          end_date: createForm.end_date || null,
          cost: createForm.cost !== '' ? Number(createForm.cost) : null,
          status: createForm.status
        })
      });
      setSuccess(`Training program "${createForm.title.trim()}" scheduled.`);
      setShowCreateModal(false);
      setCreateForm((p) => ({ ...p, title: '', provider: '', cost: '' }));
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to schedule training');
    } finally {
      setSubmitting(false);
    }
  };

  const openEvalModal = (t: TrainingProgram) => {
    const existing = evalByTraining.get(t.training_id);
    setEvalTarget(t);
    setEvalForm({
      score: existing?.score != null ? String(existing.score) : '90',
      certificate_issued: existing ? Boolean(existing.certificate_issued) : true,
      certificate_expiry: existing?.certificate_expiry ? existing.certificate_expiry.slice(0, 10) : '',
      training_status: 'Completed'
    });
    setError('');
  };

  const handleEvaluateTraining = async (e: FormEvent) => {
    e.preventDefault();
    if (!evalTarget) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await request(`/workflows/trainings/${evalTarget.training_id}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({
          score: evalForm.score !== '' ? Number(evalForm.score) : null,
          certificate_issued: evalForm.certificate_issued,
          certificate_expiry: evalForm.certificate_issued && evalForm.certificate_expiry ? evalForm.certificate_expiry : null,
          training_status: evalForm.training_status
        })
      });
      setSuccess(`Training #${evalTarget.training_id} evaluated (${evalForm.training_status}).`);
      setEvalTarget(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate training');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTrainings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeList.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (typeFilter !== 'all' && (t.type || 'Other') !== typeFilter) return false;
      if (!q) return true;
      const emp = t.employee_id ? empMap.get(t.employee_id) : null;
      const empName = emp ? `${emp.f_name} ${emp.l_name}`.toLowerCase() : '';
      return (
        t.title.toLowerCase().includes(q) ||
        (t.provider || '').toLowerCase().includes(q) ||
        (t.location || '').toLowerCase().includes(q) ||
        empName.includes(q)
      );
    });
  }, [activeList, statusFilter, typeFilter, searchQuery, empMap]);

  const activeEmployees = useMemo(() => employees.filter((e) => e.employment_status === 'Active'), [employees]);

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="eyebrow">{canManageTraining && activeTab !== 'my-training' ? 'People & Learning Development' : 'Employee Development'}</span>
          <h1 style={{ margin: '0.2rem 0', fontSize: '1.8rem', fontWeight: 700 }}>
            {canManageTraining && activeTab !== 'my-training' ? 'Training & Certifications' : 'My Training & Courses'}
          </h1>
          <p style={{ margin: 0, color: '#9898a8', fontSize: '0.9rem' }}>
            {canManageTraining && activeTab !== 'my-training'
              ? 'Assign workforce upskilling programs, track workshop budgets, and issue completion certificates.'
              : 'Review your assigned courses, schedules, and completion status.'}
          </p>
        </div>

        {canManageTraining && (
          <button
            type="button"
            className="button primary"
            onClick={() => {
              setError('');
              setCreateForm((p) => ({
                ...p,
                employee_id: activeEmployees[0] ? String(activeEmployees[0].employee_id) : ''
              }));
              setShowCreateModal(true);
            }}
          >
            + Assign Training
          </button>
        )}
      </div>

      {error && !showCreateModal && !evalTarget && (
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

      {/* KPI Strip */}
      <div className="stats-grid" style={{ margin: 0 }}>
        <article className="stat-card">
          <span>Total Enrollments</span>
          <strong>{stats.total}</strong>
          <small>Assigned courses & workshops</small>
        </article>
        <article className="stat-card">
          <span>Scheduled / Active</span>
          <strong style={{ color: '#ffd27a' }}>{stats.ongoing}</strong>
          <small>In progress or upcoming</small>
        </article>
        <article className="stat-card">
          <span>Completed</span>
          <strong style={{ color: '#8fe3b6' }}>{stats.completed}</strong>
          <small>Finished training sessions</small>
        </article>
        {canManageTraining && (
          <article className="stat-card">
            <span>Training Investment</span>
            <strong style={{ fontSize: '1.6rem', color: '#c8c0ff' }}>
              {stats.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
            </strong>
            <small>{stats.certsIssued} certificates issued</small>
          </article>
        )}
      </div>

      {/* Tabs */}
      {canManageTraining && (
        <div className="subnav-tabs" style={{ borderBottom: '1px solid #29292f', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`subnav-tab ${activeTab === 'programs' ? 'active' : ''}`}
            onClick={() => { setActiveTab('programs'); setSearchQuery(''); }}
          >
            🎓 Training Programs ({trainings.length})
          </button>
          <button
            type="button"
            className={`subnav-tab ${activeTab === 'certificates' ? 'active' : ''}`}
            onClick={() => { setActiveTab('certificates'); setSearchQuery(''); }}
          >
            📜 Evaluations & Certificates ({evaluations.length})
          </button>
          {user?.employee_id && (
            <button
              type="button"
              className={`subnav-tab ${activeTab === 'my-training' ? 'active' : ''}`}
              onClick={() => { setActiveTab('my-training'); setSearchQuery(''); }}
            >
              👤 My Courses ({myTrainings.length})
            </button>
          )}
        </div>
      )}

      {/* PROGRAMS TABLE */}
      {activeTab !== 'certificates' && (
        <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
              <input
                type="text"
                placeholder="Search title, provider, location, or employee…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ maxWidth: '300px' }}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '150px' }}
              >
                <option value="all">All Statuses</option>
                {TRAINING_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '170px' }}
              >
                <option value="all">All Categories</option>
                {TRAINING_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#9898a8' }}>
              Showing {filteredTrainings.length} of {activeList.length}
            </span>
          </div>

          {loading ? (
            <p className="loading-cell">Loading training schedules…</p>
          ) : filteredTrainings.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem' }}>
              <h2>No training records found</h2>
              <p style={{ color: '#9898a8' }}>
                {canManageTraining ? 'Assign a course or workshop to begin tracking development.' : 'No trainings assigned to your profile.'}
              </p>
            </div>
          ) : (
            <div className="table-card" style={{ border: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Program</th>
                    {canManageTraining && activeTab === 'programs' && <th>Participant</th>}
                    <th>Type</th>
                    <th>Schedule & Venue</th>
                    {canManageTraining && <th>Cost</th>}
                    <th>Status</th>
                    {canManageTraining && <th style={{ textAlign: 'right' }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredTrainings.map((t) => {
                    const emp = t.employee_id ? empMap.get(t.employee_id) : null;
                    const ev = evalByTraining.get(t.training_id);

                    return (
                      <tr key={t.training_id}>
                        <td>
                          <strong>{t.title}</strong>
                          <small>{t.provider || 'Internal L&D'}</small>
                        </td>
                        {canManageTraining && activeTab === 'programs' && (
                          <td>
                            <strong>{emp ? `${emp.f_name} ${emp.l_name}` : t.employee_id ? `Employee #${t.employee_id}` : 'Team-wide'}</strong>
                            <small>{emp?.email || '—'}</small>
                          </td>
                        )}
                        <td><span className="badge-type">{t.type || 'General'}</span></td>
                        <td>
                          <span>{formatDate(t.start_date)} → {formatDate(t.end_date)}</span>
                          <small>{t.location || 'TBD'}</small>
                        </td>
                        {canManageTraining && (
                          <td>{t.cost != null ? `${Number(t.cost).toLocaleString()} ETB` : '—'}</td>
                        )}
                        <td>
                          <span className={getTrainingBadge(t.status)}>{t.status}</span>
                          {ev?.certificate_issued && <small style={{ color: '#8fe3b6' }}>📜 Certified ({ev.score ?? 'Pass'})</small>}
                        </td>
                        {canManageTraining && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="button btn-sm"
                              onClick={() => openEvalModal(t)}
                            >
                              {ev ? 'Re-evaluate' : 'Evaluate / Certify'}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB: EVALUATIONS & CERTIFICATES */}
      {canManageTraining && activeTab === 'certificates' && (
        <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Issued Training Evaluations & Credentials</h2>
          {evaluations.length === 0 ? (
            <p className="loading-cell" style={{ padding: '2rem' }}>No training evaluations submitted yet.</p>
          ) : (
            <div className="table-card" style={{ border: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Eval ID</th>
                    <th>Course & Participant</th>
                    <th>Score</th>
                    <th>Certificate</th>
                    <th>Expiry Date</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map((ev) => {
                    const tr = trainingMap.get(ev.training_id);
                    const emp = tr?.employee_id ? empMap.get(tr.employee_id) : null;
                    return (
                      <tr key={ev.eval_id}>
                        <td><strong>#{ev.eval_id}</strong></td>
                        <td>
                          <strong>{tr?.title || `Training #${ev.training_id}`}</strong>
                          <small>{emp ? `${emp.f_name} ${emp.l_name}` : tr?.provider || '—'}</small>
                        </td>
                        <td><strong>{ev.score != null ? `${ev.score}%` : '—'}</strong></td>
                        <td>
                          <span className={`badge ${ev.certificate_issued ? 'badge-approved' : 'badge-draft'}`}>
                            {ev.certificate_issued ? 'Certificate Issued' : 'No Certificate'}
                          </span>
                        </td>
                        <td>{formatDate(ev.certificate_expiry)}</td>
                        <td>{formatDate(ev.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* MODAL: CREATE / ASSIGN TRAINING */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-heading">
              <h2>Assign Training Program</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}>×</button>
            </div>
            <form onSubmit={handleCreateTraining} style={{ display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-error">⚠️ {error}</div>}

              <label>
                Program / Course Title *
                <input
                  required
                  placeholder="e.g. Advanced TypeScript & Security Engineering"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                />
              </label>

              <div className="form-grid">
                <label>
                  Participant Employee
                  <select
                    value={createForm.employee_id}
                    onChange={(e) => setCreateForm((p) => ({ ...p, employee_id: e.target.value }))}
                  >
                    <option value="">— Cohort / Unassigned —</option>
                    {activeEmployees.map((emp) => (
                      <option key={emp.employee_id} value={emp.employee_id}>
                        {emp.f_name} {emp.l_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Training Category
                  <select
                    value={createForm.type}
                    onChange={(e) => setCreateForm((p) => ({ ...p, type: e.target.value }))}
                  >
                    {TRAINING_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Training Provider
                  <input
                    placeholder="e.g. Coursera, Internal L&D, AWS"
                    value={createForm.provider}
                    onChange={(e) => setCreateForm((p) => ({ ...p, provider: e.target.value }))}
                  />
                </label>

                <label>
                  Venue / Location
                  <input
                    value={createForm.location}
                    onChange={(e) => setCreateForm((p) => ({ ...p, location: e.target.value }))}
                  />
                </label>

                <label>
                  Start Date
                  <input
                    type="date"
                    value={createForm.start_date}
                    onChange={(e) => setCreateForm((p) => ({ ...p, start_date: e.target.value }))}
                  />
                </label>

                <label>
                  End Date
                  <input
                    type="date"
                    value={createForm.end_date}
                    onChange={(e) => setCreateForm((p) => ({ ...p, end_date: e.target.value }))}
                  />
                </label>

                <label>
                  Program Cost (ETB)
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={createForm.cost}
                    onChange={(e) => setCreateForm((p) => ({ ...p, cost: e.target.value }))}
                  />
                </label>

                <label>
                  Initial Status *
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    {TRAINING_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="button" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>
                  {submitting ? 'Scheduling…' : 'Assign Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EVALUATE & ISSUE CERTIFICATE */}
      {evalTarget && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-heading">
              <h2>Evaluate: {evalTarget.title}</h2>
              <button type="button" onClick={() => setEvalTarget(null)} style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}>×</button>
            </div>
            <form onSubmit={handleEvaluateTraining} style={{ display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-error">⚠️ {error}</div>}
              <div className="form-grid">
                <label>
                  Assessment Score (0–100)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={evalForm.score}
                    onChange={(e) => setEvalForm((p) => ({ ...p, score: e.target.value }))}
                  />
                </label>
                <label>
                  Final Training Status *
                  <select
                    value={evalForm.training_status}
                    onChange={(e) => setEvalForm((p) => ({ ...p, training_status: e.target.value }))}
                  >
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ width: '16px', height: '16px' }}
                  checked={evalForm.certificate_issued}
                  onChange={(e) => setEvalForm((p) => ({ ...p, certificate_issued: e.target.checked }))}
                />
                <span>Issue Completion Certificate</span>
              </label>

              {evalForm.certificate_issued && (
                <label>
                  Certificate Expiry Date (Optional)
                  <input
                    type="date"
                    value={evalForm.certificate_expiry}
                    onChange={(e) => setEvalForm((p) => ({ ...p, certificate_expiry: e.target.value }))}
                  />
                </label>
              )}

              <div className="modal-actions">
                <button type="button" className="button" onClick={() => setEvalTarget(null)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save Evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
