import { useCallback, useEffect, useMemo, useState } from 'react';
import { request } from '../../api';
import { useAuth } from '../../auth';
import type { Department, Employee, EmployeeExit, OnboardingChecklist, OnboardingTask } from '../../types';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

const DEFAULT_ONBOARDING_TASKS = [
  'Submit national ID and personal contact details',
  'Sign employment contract and company policies',
  'Provision workstation, laptop, and security badge',
  'Setup corporate email, Slack, and system credentials',
  'Complete mandatory compliance & safety orientation',
  'Introductory 1-on-1 with reporting manager and team welcome'
];

export function OnboardingPage() {
  const { user } = useAuth();

  const canManageOrg = useMemo(() => {
    if (!user) return false;
    if (user.roles?.includes('Admin') || user.permissions?.includes('manage_all')) return true;
    return user.permissions?.some((p) => ['manage_org', 'manage_all', 'process_exit'].includes(p));
  }, [user]);

  const [activeTab, setActiveTab] = useState<'checklists' | 'exits' | 'my-onboarding'>(
    canManageOrg ? 'checklists' : 'my-onboarding'
  );

  const [checklists, setChecklists] = useState<OnboardingChecklist[]>([]);
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [exits, setExits] = useState<EmployeeExit[]>([]);
  const [employees, setEmployees] = useState<Map<number, Employee>>(new Map());
  const [departments, setDepartments] = useState<Map<number, string>>(new Map());

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<OnboardingChecklist | null>(null);

  // New Checklist Form
  const [newChecklistForm, setNewChecklistForm] = useState({
    employee_id: '',
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    tasks: [...DEFAULT_ONBOARDING_TASKS],
    customTaskInput: ''
  });

  // Process Exit Form
  const [exitForm, setExitForm] = useState({
    employee_id: '',
    exit_type: 'Resignation',
    last_working_day: new Date().toISOString().slice(0, 10),
    clearance_status: 'Pending',
    reason: ''
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'In_Progress' | 'Completed'>('all');
  const [clearanceFilter, setClearanceFilter] = useState<'all' | 'Pending' | 'In_Progress' | 'Cleared' | 'On_Hold'>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (canManageOrg) {
        const [checklistsRes, tasksRes, exitsRes, empsRes, deptsRes] = await Promise.all([
          request<OnboardingChecklist[]>('/data/org/onboarding_checklists?limit=500').catch(() => ({ data: [] as OnboardingChecklist[] })),
          request<OnboardingTask[]>('/data/org/onboarding_tasks?limit=1500').catch(() => ({ data: [] as OnboardingTask[] })),
          request<EmployeeExit[]>('/data/org/employee_exits?limit=500').catch(() => ({ data: [] as EmployeeExit[] })),
          request<Employee[]>('/data/org/employee?limit=300').catch(() => ({ data: [] as Employee[] })),
          request<Department[]>('/data/org/departments?limit=50').catch(() => ({ data: [] as Department[] }))
        ]);

        setChecklists(checklistsRes.data || []);
        setTasks(tasksRes.data || []);
        setExits((exitsRes.data || []).sort((a, b) => new Date(b.last_working_day).getTime() - new Date(a.last_working_day).getTime()));

        const empMap = new Map<number, Employee>();
        for (const e of empsRes.data || []) empMap.set(e.employee_id, e);
        setEmployees(empMap);

        const deptMap = new Map<number, string>();
        for (const d of deptsRes.data || []) deptMap.set(d.dept_id, d.dept_name);
        setDepartments(deptMap);
      } else {
        // Self-service employee
        const [checklistsRes, tasksRes, exitsRes] = await Promise.all([
          request<OnboardingChecklist[]>('/data/org/onboarding_checklists?limit=10').catch(() => ({ data: [] as OnboardingChecklist[] })),
          request<OnboardingTask[]>('/data/org/onboarding_tasks?limit=500').catch(() => ({ data: [] as OnboardingTask[] })),
          request<EmployeeExit[]>('/data/org/employee_exits?limit=10').catch(() => ({ data: [] as EmployeeExit[] }))
        ]);

        setChecklists(checklistsRes.data || []);
        setTasks(tasksRes.data || []);
        setExits(exitsRes.data || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load onboarding lifecycle data');
    } finally {
      setLoading(false);
    }
  }, [canManageOrg]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Map checklist_id to tasks
  const tasksByChecklist = useMemo(() => {
    const map = new Map<number, OnboardingTask[]>();
    for (const t of tasks) {
      const list = map.get(t.checklist_id) || [];
      list.push(t);
      map.set(t.checklist_id, list);
    }
    return map;
  }, [tasks]);

  // Compute progress for a checklist
  const getChecklistProgress = useCallback((checklistId: number) => {
    const list = tasksByChecklist.get(checklistId) || [];
    if (list.length === 0) return { total: 0, done: 0, percent: 0 };
    const done = list.filter((t) => t.status === 'Done').length;
    return {
      total: list.length,
      done,
      percent: Math.round((done / list.length) * 100)
    };
  }, [tasksByChecklist]);

  // Handle Complete Task
  const handleCompleteTask = async (taskId: number) => {
    setActionLoading(`complete-${taskId}`);
    setError('');
    try {
      await request(`/workflows/onboarding/tasks/${taskId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ completed_by: user?.employee_id || null })
      });
      setSuccess('Task marked as completed!');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Create Checklist
  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistForm.employee_id) {
      setError('Please select an employee.');
      return;
    }
    if (newChecklistForm.tasks.length === 0) {
      setError('Please provide at least one task for the checklist.');
      return;
    }

    setActionLoading('create-checklist');
    setError('');
    try {
      await request('/workflows/onboarding/checklists', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(newChecklistForm.employee_id),
          due_date: newChecklistForm.due_date || null,
          task_names: newChecklistForm.tasks
        })
      });
      setSuccess('Onboarding checklist initiated successfully!');
      setShowCreateModal(false);
      setNewChecklistForm({
        employee_id: '',
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        tasks: [...DEFAULT_ONBOARDING_TASKS],
        customTaskInput: ''
      });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create onboarding checklist');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Process Exit
  const handleProcessExit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitForm.employee_id) {
      setError('Please select an employee to process exit.');
      return;
    }

    setActionLoading('process-exit');
    setError('');
    try {
      await request(`/workflows/employees/${exitForm.employee_id}/exit`, {
        method: 'POST',
        body: JSON.stringify({
          exit_type: exitForm.exit_type,
          last_working_day: exitForm.last_working_day,
          reason: exitForm.reason || null,
          clearance_status: exitForm.clearance_status
        })
      });
      setSuccess('Employee exit processed and contracts updated.');
      setShowExitModal(false);
      setExitForm({
        employee_id: '',
        exit_type: 'Resignation',
        last_working_day: new Date().toISOString().slice(0, 10),
        clearance_status: 'Pending',
        reason: ''
      });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process employee exit');
    } finally {
      setActionLoading(null);
    }
  };

  // Add custom task to creation form
  const handleAddCustomTask = () => {
    const text = newChecklistForm.customTaskInput.trim();
    if (!text) return;
    setNewChecklistForm((prev) => ({
      ...prev,
      tasks: [...prev.tasks, text],
      customTaskInput: ''
    }));
  };

  // Remove task from creation form
  const handleRemoveTask = (index: number) => {
    setNewChecklistForm((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
    }));
  };

  // Filtered checklists
  const filteredChecklists = useMemo(() => {
    return checklists.filter((c) => {
      const emp = employees.get(c.employee_id);
      const name = emp ? `${emp.f_name} ${emp.l_name}`.toLowerCase() : `employee #${c.employee_id}`;
      const matchesSearch = !searchQuery || name.includes(searchQuery.toLowerCase()) || String(c.checklist_id).includes(searchQuery);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [checklists, employees, searchQuery, statusFilter]);

  // Filtered exits
  const filteredExits = useMemo(() => {
    return exits.filter((exit) => {
      const emp = employees.get(exit.employee_id);
      const name = emp ? `${emp.f_name} ${emp.l_name}`.toLowerCase() : `employee #${exit.employee_id}`;
      const matchesSearch = !searchQuery || name.includes(searchQuery.toLowerCase()) || String(exit.exit_id).includes(searchQuery);
      const matchesClearance = clearanceFilter === 'all' || exit.clearance_status === clearanceFilter;
      return matchesSearch && matchesClearance;
    });
  }, [exits, employees, searchQuery, clearanceFilter]);

  // My Onboarding (self-service) data
  const myChecklists = useMemo(() => {
    if (!user?.employee_id) return checklists;
    return checklists.filter((c) => c.employee_id === user.employee_id);
  }, [checklists, user?.employee_id]);

  const myExitRecord = useMemo(() => {
    if (!user?.employee_id) return exits[0] || null;
    return exits.find((e) => e.employee_id === user.employee_id) || null;
  }, [exits, user?.employee_id]);

  // Stats for Admin
  const stats = useMemo(() => {
    const totalChecklists = checklists.length;
    const inProgress = checklists.filter((c) => c.status === 'In_Progress').length;
    const completed = checklists.filter((c) => c.status === 'Completed').length;
    const totalExits = exits.length;
    return { totalChecklists, inProgress, completed, totalExits };
  }, [checklists, exits]);

  // Active employees for dropdown
  const activeEmployeeList = useMemo(() => {
    return Array.from(employees.values()).filter((e) => e.employment_status !== 'Terminated' && e.employment_status !== 'Resigned');
  }, [employees]);

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="eyebrow">{canManageOrg ? 'Operations & Lifecycle' : 'Employee Portal'}</span>
          <h1 style={{ margin: '0.2rem 0', fontSize: '1.8rem', fontWeight: 700 }}>
            {canManageOrg ? 'Onboarding & Offboarding Lifecycle' : 'My Onboarding & Clearance'}
          </h1>
          <p style={{ margin: 0, color: '#9898a8', fontSize: '0.9rem' }}>
            {canManageOrg
              ? 'Manage new hire onboarding checklists, monitor task milestones, and process employee exits.'
              : 'Complete your onboarding checklist milestones and track your departure clearance.'}
          </p>
        </div>

        {canManageOrg && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="button-secondary"
              onClick={() => { setShowExitModal(true); setError(''); setSuccess(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              🚪 Process Exit
            </button>
            <button
              type="button"
              className="button-primary"
              onClick={() => { setShowCreateModal(true); setError(''); setSuccess(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              + Initiate Onboarding
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✅ {success}</span>
          <button type="button" onClick={() => setSuccess('')} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
        </div>
      )}

      {/* KPI Cards (for Admin/HR) */}
      {canManageOrg && (
        <div className="stats-grid">
          <article className="stat-card">
            <span>Total Checklists</span>
            <strong>{stats.totalChecklists}</strong>
            <small>All created onboarding tracks</small>
          </article>
          <article className="stat-card">
            <span>In Progress</span>
            <strong style={{ color: '#ffd27a' }}>{stats.inProgress}</strong>
            <small>Active onboarding journeys</small>
          </article>
          <article className="stat-card">
            <span>Completed</span>
            <strong style={{ color: '#8fe3b6' }}>{stats.completed}</strong>
            <small>Fully onboarded team members</small>
          </article>
          <article className="stat-card">
            <span>Recorded Exits</span>
            <strong style={{ color: '#ff9494' }}>{stats.totalExits}</strong>
            <small>Resignations & clearances</small>
          </article>
        </div>
      )}

      {/* Navigation Tabs */}
      {canManageOrg && (
        <div className="subnav-tabs" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #29292f', paddingBottom: '0.5rem' }}>
          <button
            type="button"
            className={`subnav-tab ${activeTab === 'checklists' ? 'active' : ''}`}
            onClick={() => setActiveTab('checklists')}
          >
            📋 Onboarding Checklists ({checklists.length})
          </button>
          <button
            type="button"
            className={`subnav-tab ${activeTab === 'exits' ? 'active' : ''}`}
            onClick={() => setActiveTab('exits')}
          >
            🚪 Offboarding & Exits ({exits.length})
          </button>
          {user?.employee_id && (
            <button
              type="button"
              className={`subnav-tab ${activeTab === 'my-onboarding' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-onboarding')}
            >
              👤 My Onboarding
            </button>
          )}
        </div>
      )}

      {/* TAB 1: ONBOARDING CHECKLISTS (ADMIN) */}
      {canManageOrg && activeTab === 'checklists' && (
        <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search by employee name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: '#1b1b22',
                  border: '1px solid #2e2e38',
                  borderRadius: '0.4rem',
                  padding: '0.5rem 0.8rem',
                  color: '#fff',
                  minWidth: '260px'
                }}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'In_Progress' | 'Completed')}
                style={{
                  background: '#1b1b22',
                  border: '1px solid #2e2e38',
                  borderRadius: '0.4rem',
                  padding: '0.5rem 0.8rem',
                  color: '#fff'
                }}
              >
                <option value="all">All Statuses</option>
                <option value="In_Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#9898a8' }}>
              Showing {filteredChecklists.length} of {checklists.length} checklists
            </span>
          </div>

          {/* Table */}
          {loading ? (
            <p className="loading-cell">Loading onboarding checklists…</p>
          ) : filteredChecklists.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem' }}>
              <h2>No onboarding checklists found</h2>
              <p style={{ color: '#9898a8', marginTop: '0.5rem' }}>
                {searchQuery || statusFilter !== 'all'
                  ? 'No checklists match your search filters.'
                  : 'Get started by creating an onboarding checklist for a newly hired employee.'}
              </p>
              {canManageOrg && (
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setShowCreateModal(true)}
                  style={{ marginTop: '1rem' }}
                >
                  + Initiate First Onboarding
                </button>
              )}
            </div>
          ) : (
            <div className="table-card" style={{ border: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Checklist ID</th>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChecklists.map((c) => {
                    const emp = employees.get(c.employee_id);
                    const deptName = emp?.dept_id ? departments.get(emp.dept_id) || `Dept #${emp.dept_id}` : 'General';
                    const progress = getChecklistProgress(c.checklist_id);

                    return (
                      <tr key={`chk-${c.checklist_id}`}>
                        <td>
                          <strong>#{c.checklist_id}</strong>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#30303c',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                color: '#b7a9ff'
                              }}
                            >
                              {emp ? `${emp.f_name[0]}${emp.l_name[0]}` : `#${c.employee_id}`}
                            </div>
                            <div>
                              <strong>{emp ? `${emp.f_name} ${emp.l_name}` : `Employee #${c.employee_id}`}</strong>
                              <small style={{ color: '#9898a8' }}>{emp?.email || '—'}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge-type">{deptName}</span>
                        </td>
                        <td style={{ minWidth: '180px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div
                              style={{
                                flex: 1,
                                height: '8px',
                                background: '#24242e',
                                borderRadius: '4px',
                                overflow: 'hidden'
                              }}
                            >
                              <div
                                style={{
                                  width: `${progress.percent}%`,
                                  height: '100%',
                                  background: progress.percent === 100 ? '#8fe3b6' : '#7c6af0',
                                  transition: 'width 0.3s ease'
                                }}
                              />
                            </div>
                            <small style={{ fontWeight: 600, minWidth: '55px' }}>
                              {progress.done}/{progress.total} ({progress.percent}%)
                            </small>
                          </div>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: c.status === 'Completed' ? 'rgba(62,207,142,.14)' : 'rgba(245,166,35,.14)',
                              color: c.status === 'Completed' ? '#8fe3b6' : '#ffd27a',
                              border: `1px solid ${c.status === 'Completed' ? 'rgba(62,207,142,.28)' : 'rgba(245,166,35,.28)'}`
                            }}
                          >
                            {c.status === 'Completed' ? 'Completed' : 'In Progress'}
                          </span>
                        </td>
                        <td>{formatDate(c.created_at)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => setSelectedChecklist(c)}
                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                          >
                            🔍 View Tasks
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
      )}

      {/* TAB 2: OFFBOARDING & EXITS (ADMIN) */}
      {canManageOrg && activeTab === 'exits' && (
        <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search by employee name or exit ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: '#1b1b22',
                  border: '1px solid #2e2e38',
                  borderRadius: '0.4rem',
                  padding: '0.5rem 0.8rem',
                  color: '#fff',
                  minWidth: '260px'
                }}
              />
              <select
                value={clearanceFilter}
                onChange={(e) => setClearanceFilter(e.target.value as 'all' | 'Pending' | 'In_Progress' | 'Cleared' | 'On_Hold')}
                style={{
                  background: '#1b1b22',
                  border: '1px solid #2e2e38',
                  borderRadius: '0.4rem',
                  padding: '0.5rem 0.8rem',
                  color: '#fff'
                }}
              >
                <option value="all">All Clearance States</option>
                <option value="Pending">Pending Clearance</option>
                <option value="In_Progress">In Progress</option>
                <option value="Cleared">Cleared</option>
                <option value="On_Hold">On Hold</option>
              </select>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#9898a8' }}>
              Showing {filteredExits.length} of {exits.length} exit records
            </span>
          </div>

          {/* Table */}
          {loading ? (
            <p className="loading-cell">Loading exit records…</p>
          ) : filteredExits.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem' }}>
              <h2>No exit records found</h2>
              <p style={{ color: '#9898a8', marginTop: '0.5rem' }}>
                {searchQuery || clearanceFilter !== 'all'
                  ? 'No exit records match your search filters.'
                  : 'All employees are currently active and in good standing.'}
              </p>
              {canManageOrg && (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setShowExitModal(true)}
                  style={{ marginTop: '1rem' }}
                >
                  🚪 Record an Employee Exit
                </button>
              )}
            </div>
          ) : (
            <div className="table-card" style={{ border: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Exit ID</th>
                    <th>Employee</th>
                    <th>Exit Type</th>
                    <th>Last Working Day</th>
                    <th>Clearance Status</th>
                    <th>Reason / Notes</th>
                    <th>Recorded Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExits.map((exit) => {
                    const emp = employees.get(exit.employee_id);
                    const isCleared = exit.clearance_status === 'Cleared';
                    const isPending = exit.clearance_status === 'Pending';

                    return (
                      <tr key={`exit-${exit.exit_id}`}>
                        <td>
                          <strong>#{exit.exit_id}</strong>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#352528',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                color: '#ff9494'
                              }}
                            >
                              {emp ? `${emp.f_name[0]}${emp.l_name[0]}` : `#${exit.employee_id}`}
                            </div>
                            <div>
                              <strong>{emp ? `${emp.f_name} ${emp.l_name}` : `Employee #${exit.employee_id}`}</strong>
                              <small style={{ color: '#9898a8' }}>{emp?.email || '—'}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(235,87,87,.14)',
                              color: '#ff9494',
                              border: '1px solid rgba(235,87,87,.28)'
                            }}
                          >
                            {exit.exit_type}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#ffd27a' }}>{formatDate(exit.last_working_day)}</strong>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: isCleared ? 'rgba(62,207,142,.14)' : isPending ? 'rgba(245,166,35,.14)' : 'rgba(124,106,240,.14)',
                              color: isCleared ? '#8fe3b6' : isPending ? '#ffd27a' : '#b7a9ff',
                              border: `1px solid ${isCleared ? 'rgba(62,207,142,.28)' : isPending ? 'rgba(245,166,35,.28)' : 'rgba(124,106,240,.28)'}`
                            }}
                          >
                            {exit.clearance_status}
                          </span>
                        </td>
                        <td style={{ maxWidth: '280px', whiteSpace: 'normal' }}>
                          <span style={{ fontSize: '0.85rem', color: '#c9c9d2' }}>{exit.reason || '—'}</span>
                        </td>
                        <td>{formatDate(exit.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: SELF-SERVICE (MY ONBOARDING & CLEARANCE) */}
      {(!canManageOrg || activeTab === 'my-onboarding') && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Welcome Card */}
          <div
            className="card"
            style={{
              padding: '1.5rem 1.75rem',
              background: 'linear-gradient(135deg, rgba(124,106,240,.15) 0%, rgba(30,30,40,.8) 100%)',
              border: '1px solid rgba(124,106,240,.25)'
            }}
          >
            <span className="eyebrow" style={{ color: '#b7a9ff' }}>Employee Journey & Compliance</span>
            <h2 style={{ margin: '0.3rem 0 0.5rem', fontSize: '1.4rem' }}>
              Welcome, {user?.f_name || user?.username}!
            </h2>
            <p style={{ margin: 0, color: '#c9c9d2', maxWidth: '650px', fontSize: '0.92rem' }}>
              Complete the assigned onboarding milestones below to finish setting up your work accounts, access rights, and corporate verification.
            </p>
          </div>

          {/* Exit / Clearance Banner if employee has an active exit record */}
          {myExitRecord && (
            <div
              className="card"
              style={{
                padding: '1.25rem 1.5rem',
                border: '1px solid rgba(235,87,87,.3)',
                background: 'rgba(235,87,87,.08)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <span className="eyebrow" style={{ color: '#ff9494' }}>Clearance & Exit Record</span>
                  <h3 style={{ margin: '0.2rem 0', fontSize: '1.1rem' }}>Departure Formalities in Progress</h3>
                  <p style={{ margin: 0, color: '#c9c9d2', fontSize: '0.88rem' }}>
                    Last Working Day: <strong style={{ color: '#fff' }}>{formatDate(myExitRecord.last_working_day)}</strong> ·
                    Exit Type: <strong style={{ color: '#fff' }}>{myExitRecord.exit_type}</strong> ·
                    Clearance Status: <strong style={{ color: '#ffd27a' }}>{myExitRecord.clearance_status}</strong>
                  </p>
                  {myExitRecord.reason && (
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: '#9898a8' }}>
                      Notes: {myExitRecord.reason}
                    </p>
                  )}
                </div>
                <span
                  className="badge"
                  style={{
                    background: myExitRecord.clearance_status === 'Cleared' ? 'rgba(62,207,142,.2)' : 'rgba(245,166,35,.2)',
                    color: myExitRecord.clearance_status === 'Cleared' ? '#8fe3b6' : '#ffd27a',
                    border: '1px solid currentColor',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.85rem'
                  }}
                >
                  Clearance: {myExitRecord.clearance_status}
                </span>
              </div>
            </div>
          )}

          {/* Checklists Feed */}
          {loading ? (
            <p className="loading-cell">Loading your onboarding tasks…</p>
          ) : myChecklists.length === 0 ? (
            <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem' }}>All Set! No Pending Onboarding Track</h3>
              <p style={{ color: '#9898a8', maxWidth: '480px', margin: '0 auto', fontSize: '0.9rem' }}>
                You do not have any pending onboarding tasks assigned. If you recently joined or transferred teams, your manager or HR administrator will initiate your track.
              </p>
            </div>
          ) : (
            myChecklists.map((chk) => {
              const chkTasks = tasksByChecklist.get(chk.checklist_id) || [];
              const progress = getChecklistProgress(chk.checklist_id);
              const isAllDone = progress.total > 0 && progress.done === progress.total;

              return (
                <div key={`my-chk-${chk.checklist_id}`} className="card" style={{ padding: '1.5rem' }}>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Onboarding Track #{chk.checklist_id}</h3>
                        <span
                          className="badge"
                          style={{
                            background: isAllDone ? 'rgba(62,207,142,.14)' : 'rgba(245,166,35,.14)',
                            color: isAllDone ? '#8fe3b6' : '#ffd27a',
                            border: `1px solid ${isAllDone ? 'rgba(62,207,142,.28)' : 'rgba(245,166,35,.28)'}`
                          }}
                        >
                          {isAllDone ? 'Completed' : 'In Progress'}
                        </span>
                      </div>
                      <small style={{ color: '#9898a8' }}>Initiated on {formatDate(chk.created_at)}</small>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '1.1rem', color: isAllDone ? '#8fe3b6' : '#b7a9ff' }}>
                        {progress.percent}% Completed
                      </strong>
                      <small style={{ display: 'block', color: '#9898a8' }}>
                        {progress.done} of {progress.total} milestones finished
                      </small>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div
                    style={{
                      height: '10px',
                      background: '#24242e',
                      borderRadius: '5px',
                      overflow: 'hidden',
                      marginBottom: '1.5rem'
                    }}
                  >
                    <div
                      style={{
                        width: `${progress.percent}%`,
                        height: '100%',
                        background: isAllDone ? '#8fe3b6' : 'linear-gradient(90deg, #7c6af0, #8fe3b6)',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>

                  {/* Interactive Milestones List */}
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {chkTasks.map((task) => {
                      const isDone = task.status === 'Done';
                      const isBusy = actionLoading === `complete-${task.task_id}`;

                      return (
                        <div
                          key={`task-${task.task_id}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.85rem 1.1rem',
                            borderRadius: '0.5rem',
                            background: isDone ? 'rgba(62,207,142,.05)' : '#1a1a22',
                            border: `1px solid ${isDone ? 'rgba(62,207,142,.2)' : '#2a2a35'}`,
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            <input
                              type="checkbox"
                              checked={isDone}
                              disabled={isDone || isBusy}
                              onChange={() => handleCompleteTask(task.task_id)}
                              style={{
                                width: '18px',
                                height: '18px',
                                accentColor: '#3ecf8e',
                                cursor: isDone ? 'default' : 'pointer'
                              }}
                            />
                            <div>
                              <span
                                style={{
                                  fontSize: '0.92rem',
                                  fontWeight: 500,
                                  color: isDone ? '#8fe3b6' : '#fff',
                                  textDecoration: isDone ? 'line-through' : 'none'
                                }}
                              >
                                {task.task_name}
                              </span>
                              {task.due_date && (
                                <small style={{ display: 'block', color: '#9898a8', marginTop: '0.15rem' }}>
                                  Target date: {formatDate(task.due_date)}
                                </small>
                              )}
                            </div>
                          </div>

                          <div>
                            {isDone ? (
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  color: '#8fe3b6',
                                  background: 'rgba(62,207,142,.12)',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '0.3rem',
                                  fontWeight: 600
                                }}
                              >
                                ✓ Done
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="button-secondary"
                                disabled={isBusy}
                                onClick={() => handleCompleteTask(task.task_id)}
                                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                              >
                                {isBusy ? 'Saving…' : 'Mark Complete'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL 1: INITIATE ONBOARDING CHECKLIST */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Initiate New Onboarding Track</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateChecklist} style={{ display: 'grid', gap: '1.2rem', marginTop: '1rem' }}>
              <div className="form-grid">
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="chk-emp" style={{ fontSize: '0.85rem', color: '#9898a8' }}>
                    Select Employee *
                  </label>
                  <select
                    id="chk-emp"
                    required
                    value={newChecklistForm.employee_id}
                    onChange={(e) => setNewChecklistForm((prev) => ({ ...prev, employee_id: e.target.value }))}
                    style={{
                      background: '#1b1b22',
                      border: '1px solid #2e2e38',
                      borderRadius: '0.4rem',
                      padding: '0.55rem',
                      color: '#fff'
                    }}
                  >
                    <option value="">— Select New Hire —</option>
                    {activeEmployeeList.map((e) => (
                      <option key={`emp-opt-${e.employee_id}`} value={e.employee_id}>
                        {e.f_name} {e.l_name} ({e.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="chk-due" style={{ fontSize: '0.85rem', color: '#9898a8' }}>
                    Target Completion Date
                  </label>
                  <input
                    id="chk-due"
                    type="date"
                    value={newChecklistForm.due_date}
                    onChange={(e) => setNewChecklistForm((prev) => ({ ...prev, due_date: e.target.value }))}
                    style={{
                      background: '#1b1b22',
                      border: '1px solid #2e2e38',
                      borderRadius: '0.4rem',
                      padding: '0.55rem',
                      color: '#fff'
                    }}
                  />
                </div>
              </div>

              {/* Tasks Builder */}
              <div>
                <label style={{ fontSize: '0.85rem', color: '#9898a8', display: 'block', marginBottom: '0.4rem' }}>
                  Checklist Tasks & Milestones ({newChecklistForm.tasks.length})
                </label>
                <div style={{ display: 'grid', gap: '0.4rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                  {newChecklistForm.tasks.map((taskText, idx) => (
                    <div
                      key={`task-input-${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#1b1b22',
                        padding: '0.45rem 0.75rem',
                        borderRadius: '0.35rem',
                        border: '1px solid #2e2e38'
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', color: '#e0e0e8' }}>
                        {idx + 1}. {taskText}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(idx)}
                        style={{ background: 'none', border: 0, color: '#ff9494', cursor: 'pointer', fontSize: '1rem' }}
                        title="Remove task"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Custom Task Row */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                  <input
                    type="text"
                    placeholder="Add custom task or requirement..."
                    value={newChecklistForm.customTaskInput}
                    onChange={(e) => setNewChecklistForm((prev) => ({ ...prev, customTaskInput: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomTask();
                      }
                    }}
                    style={{
                      flex: 1,
                      background: '#1b1b22',
                      border: '1px solid #2e2e38',
                      borderRadius: '0.4rem',
                      padding: '0.45rem 0.7rem',
                      color: '#fff',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={handleAddCustomTask}
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.8rem' }}
                  >
                    + Add Task
                  </button>
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button-primary"
                  disabled={actionLoading === 'create-checklist'}
                >
                  {actionLoading === 'create-checklist' ? 'Creating…' : 'Start Onboarding Track'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CHECKLIST DRILL-DOWN / TASK DETAIL */}
      {selectedChecklist && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            {(() => {
              const emp = employees.get(selectedChecklist.employee_id);
              const chkTasks = tasksByChecklist.get(selectedChecklist.checklist_id) || [];
              const progress = getChecklistProgress(selectedChecklist.checklist_id);

              return (
                <div>
                  <div className="modal-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
                        Checklist #{selectedChecklist.checklist_id} — {emp ? `${emp.f_name} ${emp.l_name}` : `Employee #${selectedChecklist.employee_id}`}
                      </h2>
                      <small style={{ color: '#9898a8' }}>
                        Created: {formatDate(selectedChecklist.created_at)} · Status: {selectedChecklist.status}
                      </small>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedChecklist(null)}
                      style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Progress Header */}
                  <div style={{ marginTop: '1.2rem', marginBottom: '1.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#9898a8' }}>Onboarding Completion</span>
                      <strong style={{ color: progress.percent === 100 ? '#8fe3b6' : '#b7a9ff' }}>
                        {progress.done} / {progress.total} tasks completed ({progress.percent}%)
                      </strong>
                    </div>
                    <div
                      style={{
                        height: '8px',
                        background: '#24242e',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width: `${progress.percent}%`,
                          height: '100%',
                          background: progress.percent === 100 ? '#8fe3b6' : '#7c6af0',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>

                  {/* Tasks List */}
                  <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {chkTasks.map((t) => {
                      const isDone = t.status === 'Done';
                      const isBusy = actionLoading === `complete-${t.task_id}`;

                      return (
                        <div
                          key={`drill-task-${t.task_id}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.8rem 1rem',
                            borderRadius: '0.4rem',
                            background: isDone ? 'rgba(62,207,142,.06)' : '#1b1b22',
                            border: `1px solid ${isDone ? 'rgba(62,207,142,.2)' : '#2e2e38'}`
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={isDone}
                              disabled={isDone || isBusy}
                              onChange={() => handleCompleteTask(t.task_id)}
                              style={{ width: '18px', height: '18px', accentColor: '#3ecf8e', cursor: isDone ? 'default' : 'pointer' }}
                            />
                            <div>
                              <span
                                style={{
                                  fontSize: '0.9rem',
                                  fontWeight: 500,
                                  color: isDone ? '#8fe3b6' : '#fff',
                                  textDecoration: isDone ? 'line-through' : 'none'
                                }}
                              >
                                {t.task_name}
                              </span>
                              {t.due_date && (
                                <small style={{ display: 'block', color: '#9898a8', fontSize: '0.75rem' }}>
                                  Target: {formatDate(t.due_date)}
                                </small>
                              )}
                            </div>
                          </div>

                          <div>
                            {isDone ? (
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  color: '#8fe3b6',
                                  background: 'rgba(62,207,142,.12)',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '0.3rem',
                                  fontWeight: 600
                                }}
                              >
                                ✓ Done
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="button-secondary"
                                disabled={isBusy}
                                onClick={() => handleCompleteTask(t.task_id)}
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                              >
                                {isBusy ? 'Saving…' : 'Mark Done'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => setSelectedChecklist(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL 3: PROCESS EMPLOYEE EXIT */}
      {showExitModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Process Employee Exit & Clearance</h2>
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleProcessExit} style={{ display: 'grid', gap: '1.2rem', marginTop: '1rem' }}>
              {/* Notice Box */}
              <div
                style={{
                  background: 'rgba(235,87,87,.08)',
                  border: '1px solid rgba(235,87,87,.25)',
                  borderRadius: '0.4rem',
                  padding: '0.75rem 1rem',
                  color: '#ff9494',
                  fontSize: '0.85rem'
                }}
              >
                ⚠️ <strong>Lifecycle Action:</strong> Processing an exit will update the employee record to Resigned/Terminated, deactivate all active compensation contracts, and initiate company asset recovery.
              </div>

              <div className="form-grid">
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="exit-emp" style={{ fontSize: '0.85rem', color: '#9898a8' }}>
                    Select Employee *
                  </label>
                  <select
                    id="exit-emp"
                    required
                    value={exitForm.employee_id}
                    onChange={(e) => setExitForm((prev) => ({ ...prev, employee_id: e.target.value }))}
                    style={{
                      background: '#1b1b22',
                      border: '1px solid #2e2e38',
                      borderRadius: '0.4rem',
                      padding: '0.55rem',
                      color: '#fff'
                    }}
                  >
                    <option value="">— Select Employee —</option>
                    {activeEmployeeList.map((e) => (
                      <option key={`exit-emp-${e.employee_id}`} value={e.employee_id}>
                        {e.f_name} {e.l_name} ({e.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="exit-type" style={{ fontSize: '0.85rem', color: '#9898a8' }}>
                    Exit Type *
                  </label>
                  <select
                    id="exit-type"
                    required
                    value={exitForm.exit_type}
                    onChange={(e) => setExitForm((prev) => ({ ...prev, exit_type: e.target.value }))}
                    style={{
                      background: '#1b1b22',
                      border: '1px solid #2e2e38',
                      borderRadius: '0.4rem',
                      padding: '0.55rem',
                      color: '#fff'
                    }}
                  >
                    <option value="Resignation">Resignation</option>
                    <option value="Termination">Termination</option>
                    <option value="Retirement">Retirement</option>
                    <option value="Contract End">End of Contract</option>
                    <option value="Mutual Agreement">Mutual Agreement</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="exit-lwd" style={{ fontSize: '0.85rem', color: '#9898a8' }}>
                    Last Working Day *
                  </label>
                  <input
                    id="exit-lwd"
                    type="date"
                    required
                    value={exitForm.last_working_day}
                    onChange={(e) => setExitForm((prev) => ({ ...prev, last_working_day: e.target.value }))}
                    style={{
                      background: '#1b1b22',
                      border: '1px solid #2e2e38',
                      borderRadius: '0.4rem',
                      padding: '0.55rem',
                      color: '#fff'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="exit-clr" style={{ fontSize: '0.85rem', color: '#9898a8' }}>
                    Clearance Status *
                  </label>
                  <select
                    id="exit-clr"
                    required
                    value={exitForm.clearance_status}
                    onChange={(e) => setExitForm((prev) => ({ ...prev, clearance_status: e.target.value }))}
                    style={{
                      background: '#1b1b22',
                      border: '1px solid #2e2e38',
                      borderRadius: '0.4rem',
                      padding: '0.55rem',
                      color: '#fff'
                    }}
                  >
                    <option value="Pending">Pending Clearance</option>
                    <option value="In_Progress">In Progress</option>
                    <option value="Cleared">Cleared (All Items Returned)</option>
                    <option value="On_Hold">On Hold (Pending Resolution)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <label htmlFor="exit-reason" style={{ fontSize: '0.85rem', color: '#9898a8' }}>
                  Exit Reason & Documentation
                </label>
                <textarea
                  id="exit-reason"
                  rows={3}
                  placeholder="Detail the exit context, notice period, hand-over notes, or clearance observations..."
                  value={exitForm.reason}
                  onChange={(e) => setExitForm((prev) => ({ ...prev, reason: e.target.value }))}
                  style={{
                    background: '#1b1b22',
                    border: '1px solid #2e2e38',
                    borderRadius: '0.4rem',
                    padding: '0.6rem',
                    color: '#fff',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setShowExitModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button-primary"
                  style={{ background: '#d32f2f' }}
                  disabled={actionLoading === 'process-exit'}
                >
                  {actionLoading === 'process-exit' ? 'Processing…' : 'Confirm & Process Exit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

