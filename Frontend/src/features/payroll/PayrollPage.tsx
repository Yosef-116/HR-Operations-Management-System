import { useCallback, useEffect, useMemo, useState } from 'react';
import { request } from '../../api';
import { useAuth } from '../../auth';
import type { Department, Employee, JobTitle, PayrollRun, Payslip, SalaryContract, SalaryMatrix } from '../../types';

function formatETB(value: number | string | null | undefined): string {
  const num = Number(value || 0);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ETB';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

export function PayrollPage() {
  const { user } = useAuth();

  const canManagePayroll = useMemo(() => {
    if (!user) return false;
    if (user.roles?.includes('Admin') || user.permissions?.includes('manage_all')) return true;
    return user.permissions?.some((p) =>
      ['manage_payroll', 'process_payroll', 'view_payroll', 'create_payroll'].includes(p)
    );
  }, [user]);

  const [activeTab, setActiveTab] = useState<'runs' | 'my-payslips' | 'matrix'>(canManagePayroll ? 'runs' : 'my-payslips');
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [allPayslips, setAllPayslips] = useState<Payslip[]>([]);
  const [myPayslips, setMyPayslips] = useState<Payslip[]>([]);
  const [contracts, setContracts] = useState<SalaryContract[]>([]);
  const [salaryMatrix, setSalaryMatrix] = useState<SalaryMatrix[]>([]);
  const [employees, setEmployees] = useState<Map<number, Employee>>(new Map());
  const [departments, setDepartments] = useState<Map<number, string>>(new Map());
  const [jobs, setJobs] = useState<Map<number, string>>(new Map());

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals
  const [showCreateRunModal, setShowCreateRunModal] = useState(false);
  const [newRunDate, setNewRunDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedRunForDrilldown, setSelectedRunForDrilldown] = useState<PayrollRun | null>(null);
  const [selectedPayslipForVoucher, setSelectedPayslipForVoucher] = useState<Payslip | null>(null);

  // Filters
  const [runStatusFilter, setRunStatusFilter] = useState<'all' | 'Draft' | 'Approved' | 'Processed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (canManagePayroll) {
        const [runsRes, payslipsRes, contractsRes, matrixRes, empsRes, deptsRes, jobsRes] = await Promise.all([
          request<PayrollRun[]>('/data/payroll/payroll_runs?limit=100').catch(() => ({ data: [] as PayrollRun[] })),
          request<Payslip[]>('/data/payroll/payslips?limit=1000').catch(() => ({ data: [] as Payslip[] })),
          request<SalaryContract[]>('/data/payroll/salary_contracts?limit=300').catch(() => ({ data: [] as SalaryContract[] })),
          request<SalaryMatrix[]>('/data/payroll/salary_matrix?limit=50').catch(() => ({ data: [] as SalaryMatrix[] })),
          request<Employee[]>('/data/org/employee?limit=250').catch(() => ({ data: [] as Employee[] })),
          request<Department[]>('/data/org/departments?limit=50').catch(() => ({ data: [] as Department[] })),
          request<JobTitle[]>('/data/recruitment/job_titles?limit=100').catch(() => ({ data: [] as JobTitle[] }))
        ]);

        const sortedRuns = (runsRes.data || []).sort((a, b) => new Date(b.run_date).getTime() - new Date(a.run_date).getTime());
        setRuns(sortedRuns);
        setAllPayslips(payslipsRes.data || []);
        setContracts(contractsRes.data || []);
        setSalaryMatrix(matrixRes.data || []);

        const empMap = new Map<number, Employee>();
        for (const e of empsRes.data || []) empMap.set(e.employee_id, e);
        setEmployees(empMap);

        const deptMap = new Map<number, string>();
        for (const d of deptsRes.data || []) deptMap.set(d.dept_id, d.dept_name);
        setDepartments(deptMap);

        const jobMap = new Map<number, string>();
        for (const j of jobsRes.data || []) jobMap.set(j.job_id, j.title_name);
        setJobs(jobMap);

        // Filter personal payslips for admin/manager as well
        if (user?.employee_id) {
          const mine = (payslipsRes.data || []).filter((p) => p.employee_id === user.employee_id);
          setMyPayslips(mine);
        }
      } else {
        // Regular Employee self-service
        const [payslipsRes, contractsRes, matrixRes, empsRes, deptsRes, jobsRes] = await Promise.all([
          request<Payslip[]>('/data/payroll/payslips?limit=100').catch(() => ({ data: [] as Payslip[] })),
          request<SalaryContract[]>('/data/payroll/salary_contracts?limit=10').catch(() => ({ data: [] as SalaryContract[] })),
          request<SalaryMatrix[]>('/data/payroll/salary_matrix?limit=50').catch(() => ({ data: [] as SalaryMatrix[] })),
          request<Employee[]>('/data/org/employee?limit=20').catch(() => ({ data: [] as Employee[] })),
          request<Department[]>('/data/org/departments?limit=50').catch(() => ({ data: [] as Department[] })),
          request<JobTitle[]>('/data/recruitment/job_titles?limit=100').catch(() => ({ data: [] as JobTitle[] }))
        ]);

        setMyPayslips(payslipsRes.data || []);
        setContracts(contractsRes.data || []);
        setSalaryMatrix(matrixRes.data || []);

        const empMap = new Map<number, Employee>();
        for (const e of empsRes.data || []) empMap.set(e.employee_id, e);
        setEmployees(empMap);

        const deptMap = new Map<number, string>();
        for (const d of deptsRes.data || []) deptMap.set(d.dept_id, d.dept_name);
        setDepartments(deptMap);

        const jobMap = new Map<number, string>();
        for (const j of jobsRes.data || []) jobMap.set(j.job_id, j.title_name);
        setJobs(jobMap);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load payroll records.');
    } finally {
      setLoading(false);
    }
  }, [canManagePayroll, user?.employee_id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Create New Run
  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRunDate) return;
    setActionLoading('create-run');
    setError('');
    setSuccess('');
    try {
      await request('/data/payroll/payroll_runs', {
        method: 'POST',
        body: JSON.stringify({
          run_date: newRunDate,
          status: 'Draft',
          run_by: user?.employee_id || null
        })
      });
      setSuccess('Payroll run created in Draft status.');
      setShowCreateRunModal(false);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create payroll run');
    } finally {
      setActionLoading(null);
    }
  };

  // Generate Payslips
  const handleGeneratePayslips = async (runId: number) => {
    setActionLoading(`generate-${runId}`);
    setError('');
    setSuccess('');
    try {
      const res = await request<{ created: Payslip[]; skipped: unknown[] }>(
        `/workflows/payroll/runs/${runId}/generate-payslips`,
        { method: 'POST', body: JSON.stringify({ pensionRate: 0.07 }) }
      );
      const count = res.data?.created?.length ?? 0;
      setSuccess(`Generated ${count} payslips for payroll run #${runId}.`);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not generate payslips');
    } finally {
      setActionLoading(null);
    }
  };

  // Approve Run
  const handleApproveRun = async (runId: number) => {
    setActionLoading(`approve-${runId}`);
    setError('');
    setSuccess('');
    try {
      await request(`/workflows/payroll/runs/${runId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approved_by: user?.employee_id || null })
      });
      setSuccess(`Payroll run #${runId} has been approved.`);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not approve payroll run');
    } finally {
      setActionLoading(null);
    }
  };

  // Process Run
  const handleProcessRun = async (runId: number) => {
    setActionLoading(`process-${runId}`);
    setError('');
    setSuccess('');
    try {
      await request(`/workflows/payroll/runs/${runId}/process`, {
        method: 'POST',
        body: JSON.stringify({ approved_by: user?.employee_id || null })
      });
      setSuccess(`Payroll run #${runId} processed & disbursed successfully.`);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not process payroll run');
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered runs
  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      if (runStatusFilter !== 'all' && run.status !== runStatusFilter) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesId = String(run.run_id).includes(query);
        const matchesDate = String(run.run_date).toLowerCase().includes(query);
        const matchesStatus = run.status.toLowerCase().includes(query);
        return matchesId || matchesDate || matchesStatus;
      }
      return true;
    });
  }, [runs, runStatusFilter, searchTerm]);

  // Map run_id to payslips count and net sum
  const runStats = useMemo(() => {
    const stats = new Map<number, { count: number; totalGross: number; totalNet: number }>();
    for (const p of allPayslips) {
      const current = stats.get(p.run_id) || { count: 0, totalGross: 0, totalNet: 0 };
      current.count += 1;
      current.totalGross += Number(p.gross_salary || 0);
      current.totalNet += Number(p.net_pay || 0);
      stats.set(p.run_id, current);
    }
    return stats;
  }, [allPayslips]);

  // Overall KPI stats for admin
  const totalDisbursed = useMemo(() => {
    return runs
      .filter((r) => r.status === 'Processed')
      .reduce((sum, r) => sum + (runStats.get(r.run_id)?.totalNet || 0), 0);
  }, [runs, runStats]);

  const pendingApprovalRunsCount = useMemo(() => {
    return runs.filter((r) => r.status === 'Draft' || r.status === 'Approved').length;
  }, [runs]);

  // Personal active contract
  const myContract = useMemo(() => {
    if (!user?.employee_id) return null;
    return contracts.find((c) => c.employee_id === user.employee_id && c.is_active) || contracts[0] || null;
  }, [contracts, user?.employee_id]);

  const myMatrixGrade = useMemo(() => {
    if (!myContract) return null;
    return salaryMatrix.find((m) => m.matrix_id === myContract.matrix_id) || null;
  }, [salaryMatrix, myContract]);

  // Employee details for payslip voucher
  const getEmployeeForPayslip = (empId: number) => {
    return employees.get(empId) || (user?.employee_id === empId ? ({
      employee_id: empId,
      f_name: user?.f_name || user?.username || 'Employee',
      l_name: user?.l_name || '',
      email: user?.email || '',
      hire_date: '—',
      employment_status: 'Active',
      dept_id: null,
      job_id: null
    } as Employee) : null);
  };

  return (
    <div className="payroll-module" style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Top Header */}
      <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="eyebrow">Finance & Compensation</span>
            <h1 style={{ margin: '.2rem 0 .4rem', fontSize: '1.65rem' }}>
              {canManagePayroll ? 'Payroll Management & Runs' : 'My Compensation & Payslips'}
            </h1>
            <p style={{ margin: 0, color: '#90909a', fontSize: '.9rem' }}>
              {canManagePayroll
                ? 'Manage monthly payroll runs, calculate Ethiopian statutory taxes and 7% pensions, and disburse compensation.'
                : 'Review your salary compensation contract, tax deductions, pension contributions, and download official payslip vouchers.'}
            </p>
          </div>
          {canManagePayroll && (
            <button
              className="button-primary"
              onClick={() => {
                setNewRunDate(new Date().toISOString().slice(0, 10));
                setShowCreateRunModal(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}
            >
              <span>+</span> New Payroll Run
            </button>
          )}
        </div>

        {/* Tab Navigation if user has payroll management permissions */}
        {canManagePayroll && (
          <div className="subnav-tabs" style={{ display: 'flex', gap: '.5rem', marginTop: '1.25rem', borderTop: '1px solid #2d2d35', paddingTop: '1rem' }}>
            <button
              className={`subnav-tab ${activeTab === 'runs' ? 'active' : ''}`}
              onClick={() => setActiveTab('runs')}
            >
              Payroll Runs ({runs.length})
            </button>
            <button
              className={`subnav-tab ${activeTab === 'my-payslips' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-payslips')}
            >
              My Payslips ({myPayslips.length})
            </button>
            <button
              className={`subnav-tab ${activeTab === 'matrix' ? 'active' : ''}`}
              onClick={() => setActiveTab('matrix')}
            >
              Salary Matrix & Tax Tables
            </button>
          </div>
        )}
      </section>

      {/* Notifications */}
      {error && (
        <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button className="button-link" onClick={() => setError('')} style={{ color: 'inherit' }}>✕</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✅ {success}</span>
          <button className="button-link" onClick={() => setSuccess('')} style={{ color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: PAYROLL RUNS & DISBURSALS (Admin / Finance)             */}
      {/* ============================================================== */}
      {canManagePayroll && activeTab === 'runs' && (
        <>
          {/* KPI Cards */}
          <div className="stats-grid" style={{ margin: 0 }}>
            <article className="stat-card">
              <span>Total Disbursed (Processed)</span>
              <strong>{formatETB(totalDisbursed)}</strong>
              <small>Across all processed payroll runs</small>
            </article>
            <article className="stat-card">
              <span>Payroll Runs Count</span>
              <strong>{runs.length}</strong>
              <small>{runs.filter((r) => r.status === 'Processed').length} finalized, {runs.filter((r) => r.status === 'Draft').length} drafts</small>
            </article>
            <article className="stat-card">
              <span>Action Needed</span>
              <strong style={{ color: pendingApprovalRunsCount > 0 ? '#ffd27a' : '#52d9a6' }}>
                {pendingApprovalRunsCount}
              </strong>
              <small>Runs awaiting approval or processing</small>
            </article>
            <article className="stat-card">
              <span>Active Salary Contracts</span>
              <strong>{contracts.filter((c) => c.is_active).length}</strong>
              <small>Employees eligible for payroll calculation</small>
            </article>
          </div>

          {/* Runs Table Card */}
          <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <div className="toolbar" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search by Run ID or Date…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ minWidth: '220px' }}
                />
                <select
                  value={runStatusFilter}
                  onChange={(e) => setRunStatusFilter(e.target.value as 'all' | 'Draft' | 'Approved' | 'Processed')}
                  style={{ padding: '.55rem .8rem', borderRadius: '.5rem', border: '1px solid #3b3b43', background: '#202025', color: '#f0f0f2' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Approved">Approved</option>
                  <option value="Processed">Processed</option>
                </select>
              </div>
              <button className="button-secondary" onClick={() => void loadData()} disabled={loading}>
                {loading ? 'Refreshing…' : '↻ Refresh'}
              </button>
            </div>

            {loading && runs.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#90909a' }}>Loading payroll runs…</p>
            ) : filteredRuns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#90909a' }}>
                <p style={{ fontSize: '1.1rem', margin: '0 0 .5rem', color: '#f0f0f2' }}>No payroll runs found</p>
                <small>Click &quot;+ New Payroll Run&quot; above to create a draft payroll cycle.</small>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Run ID</th>
                      <th>Pay Date</th>
                      <th>Status</th>
                      <th>Payslips</th>
                      <th>Gross Total</th>
                      <th>Net Disbursed</th>
                      <th style={{ textAlign: 'right' }}>Workflow Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRuns.map((run) => {
                      const stats = runStats.get(run.run_id) || { count: 0, totalGross: 0, totalNet: 0 };
                      const isActing = actionLoading?.includes(String(run.run_id));

                      return (
                        <tr key={run.run_id}>
                          <td><strong>#{String(run.run_id).padStart(3, '0')}</strong></td>
                          <td>{formatDate(run.run_date)}</td>
                          <td>
                            <span className={`badge ${
                              run.status === 'Processed'
                                ? 'badge-approved'
                                : run.status === 'Approved'
                                ? 'badge-pending'
                                : 'badge-draft'
                            }`}>
                              {run.status}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{stats.count}</span> <small style={{ color: '#90909a' }}>slips</small>
                          </td>
                          <td>{formatETB(stats.totalGross)}</td>
                          <td><strong>{formatETB(stats.totalNet)}</strong></td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: '.4rem', alignItems: 'center' }}>
                              <button
                                className="button-secondary"
                                onClick={() => setSelectedRunForDrilldown(run)}
                                style={{ fontSize: '.78rem', padding: '.35rem .65rem' }}
                                title="View individual employee payslips for this run"
                              >
                                👁 Details
                              </button>

                              {run.status === 'Draft' && (
                                <>
                                  <button
                                    className="button-secondary"
                                    onClick={() => handleGeneratePayslips(run.run_id)}
                                    disabled={Boolean(isActing)}
                                    style={{ fontSize: '.78rem', padding: '.35rem .65rem', color: '#8c7cf5', borderColor: '#7c6af0' }}
                                  >
                                    {actionLoading === `generate-${run.run_id}` ? 'Generating…' : '⚡ Calculate'}
                                  </button>
                                  <button
                                    className="button-primary"
                                    onClick={() => handleApproveRun(run.run_id)}
                                    disabled={Boolean(isActing) || stats.count === 0}
                                    style={{ fontSize: '.78rem', padding: '.35rem .65rem' }}
                                    title={stats.count === 0 ? 'Generate payslips first before approving' : 'Approve payroll run'}
                                  >
                                    {actionLoading === `approve-${run.run_id}` ? 'Approving…' : '✓ Approve'}
                                  </button>
                                </>
                              )}

                              {run.status === 'Approved' && (
                                <button
                                  className="button-primary"
                                  onClick={() => handleProcessRun(run.run_id)}
                                  disabled={Boolean(isActing)}
                                  style={{ fontSize: '.78rem', padding: '.35rem .65rem', background: '#25855a', borderColor: '#25855a' }}
                                >
                                  {actionLoading === `process-${run.run_id}` ? 'Processing…' : '🏦 Process & Pay'}
                                </button>
                              )}

                              {run.status === 'Processed' && (
                                <span style={{ fontSize: '.75rem', color: '#52d9a6', fontWeight: 500 }}>
                                  ✓ Completed
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ============================================================== */}
      {/* TAB 2: MY PAYSLIPS & COMPENSATION (Self-Service)               */}
      {/* ============================================================== */}
      {(!canManagePayroll || activeTab === 'my-payslips') && (
        <>
          {/* Active Compensation Contract Banner */}
          <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <span className="eyebrow">My Active Employment Contract</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginTop: '.75rem' }}>
              <div>
                <small style={{ color: '#90909a', display: 'block' }}>Contract Type</small>
                <strong style={{ fontSize: '1.1rem' }}>{myContract?.contract_type || 'Permanent Full-Time'}</strong>
              </div>
              <div>
                <small style={{ color: '#90909a', display: 'block' }}>Compensation Grade / Level</small>
                <strong style={{ fontSize: '1.1rem' }}>{myMatrixGrade ? `${myMatrixGrade.level} (Step ${myMatrixGrade.step})` : 'Standard Grade'}</strong>
              </div>
              <div>
                <small style={{ color: '#90909a', display: 'block' }}>Base Monthly Salary</small>
                <strong style={{ fontSize: '1.1rem', color: '#52d9a6' }}>
                  {formatETB(myMatrixGrade?.base_salary || myPayslips[0]?.gross_salary || 0)}
                </strong>
              </div>
              <div>
                <small style={{ color: '#90909a', display: 'block' }}>Effective Date</small>
                <strong style={{ fontSize: '1.1rem' }}>{formatDate(myContract?.start_date)}</strong>
              </div>
            </div>
          </section>

          {/* My Payslips Table */}
          <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Issued Payslips History</h3>
              <small style={{ color: '#90909a' }}>{myPayslips.length} payslips on record</small>
            </div>

            {loading && myPayslips.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#90909a' }}>Loading your payslips…</p>
            ) : myPayslips.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#90909a' }}>
                <p style={{ fontSize: '1.05rem', margin: '0 0 .5rem', color: '#f0f0f2' }}>No payslips generated yet</p>
                <small>When the Finance department processes a monthly payroll run, your payslips and deductions will appear here.</small>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Payslip #</th>
                      <th>Pay Period</th>
                      <th>Gross Pay</th>
                      <th>Income Tax (PIT)</th>
                      <th>Pension (7%)</th>
                      <th>Net Take-Home Pay</th>
                      <th style={{ textAlign: 'right' }}>Voucher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myPayslips.map((slip) => (
                      <tr key={slip.payslip_id}>
                        <td><strong>#{String(slip.payslip_id).padStart(4, '0')}</strong></td>
                        <td>{formatDate(slip.created_at)}</td>
                        <td>{formatETB(slip.gross_salary)}</td>
                        <td style={{ color: '#ffd27a' }}>{formatETB(slip.tax_amount)}</td>
                        <td style={{ color: '#ffd27a' }}>{formatETB(slip.pension_amount || 0)}</td>
                        <td><strong style={{ color: '#52d9a6' }}>{formatETB(slip.net_pay)}</strong></td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="button-primary"
                            onClick={() => setSelectedPayslipForVoucher(slip)}
                            style={{ fontSize: '.8rem', padding: '.35rem .75rem' }}
                          >
                            📄 View Voucher
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ============================================================== */}
      {/* TAB 3: SALARY MATRIX & TAX BRACKETS (Transparency View)        */}
      {/* ============================================================== */}
      {canManagePayroll && activeTab === 'matrix' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Salary Matrix Tiers */}
          <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Organizational Salary Matrix</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tier ID</th>
                    <th>Grade Level</th>
                    <th>Step</th>
                    <th>Base Monthly Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryMatrix.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: '#90909a' }}>No tiers registered</td></tr>
                  ) : (
                    salaryMatrix.map((m) => (
                      <tr key={m.matrix_id}>
                        <td>#{m.matrix_id}</td>
                        <td><strong>{m.level}</strong></td>
                        <td>Step {m.step}</td>
                        <td><strong style={{ color: '#52d9a6' }}>{formatETB(m.base_salary)}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Statutory Tax Brackets */}
          <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Ethiopian Statutory Tax Brackets</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Monthly Income Band</th>
                    <th>PIT Rate</th>
                    <th>Deductible Fee</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>0 – 600 ETB</td><td><strong>0%</strong> (Exempt)</td><td>0.00 ETB</td></tr>
                  <tr><td>601 – 1,650 ETB</td><td><strong>10%</strong></td><td>60.00 ETB</td></tr>
                  <tr><td>1,651 – 3,200 ETB</td><td><strong>15%</strong></td><td>142.50 ETB</td></tr>
                  <tr><td>3,201 – 5,250 ETB</td><td><strong>20%</strong></td><td>302.50 ETB</td></tr>
                  <tr><td>5,251 – 7,800 ETB</td><td><strong>25%</strong></td><td>565.00 ETB</td></tr>
                  <tr><td>7,801 – 10,900 ETB</td><td><strong>30%</strong></td><td>955.00 ETB</td></tr>
                  <tr><td>Above 10,900 ETB</td><td><strong>35%</strong></td><td>1,500.00 ETB</td></tr>
                </tbody>
              </table>
            </div>
            <p style={{ margin: '1rem 0 0', fontSize: '.8rem', color: '#90909a' }}>
              ℹ️ In addition to personal income tax, a mandatory <strong>7% Employee Pension Contribution</strong> is deducted automatically.
            </p>
          </section>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE NEW PAYROLL RUN                                  */}
      {/* ============================================================== */}
      {showCreateRunModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateRunModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <h2>Schedule New Payroll Run</h2>
              <button className="button-link" onClick={() => setShowCreateRunModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateRun}>
              <div className="form-grid">
                <div className="wide">
                  <label htmlFor="run-date">Payroll Run / Pay Date *</label>
                  <input
                    id="run-date"
                    type="date"
                    required
                    value={newRunDate}
                    onChange={(e) => setNewRunDate(e.target.value)}
                  />
                  <small style={{ color: '#90909a', marginTop: '.3rem', display: 'block' }}>
                    The target cycle date. Once created in Draft mode, you can calculate payslips, review the numbers, and approve for disbursement.
                  </small>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="button-secondary" onClick={() => setShowCreateRunModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="button-primary" disabled={actionLoading === 'create-run'}>
                  {actionLoading === 'create-run' ? 'Creating…' : 'Create Draft Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: RUN PAYSLIPS DRILL-DOWN (Admin / Finance)               */}
      {/* ============================================================== */}
      {selectedRunForDrilldown && (
        <div className="modal-backdrop" onClick={() => setSelectedRunForDrilldown(null)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ width: 'min(900px, 98%)' }}>
            <div className="modal-heading">
              <div>
                <h2 style={{ margin: 0 }}>Payroll Run #{selectedRunForDrilldown.run_id} Breakdown</h2>
                <small style={{ color: '#90909a' }}>
                  Target Date: {formatDate(selectedRunForDrilldown.run_date)} | Status: <strong>{selectedRunForDrilldown.status}</strong>
                </small>
              </div>
              <button className="button-link" onClick={() => setSelectedRunForDrilldown(null)}>✕</button>
            </div>

            {(() => {
              const runSlips = allPayslips.filter((p) => p.run_id === selectedRunForDrilldown.run_id);
              const totalGross = runSlips.reduce((acc, s) => acc + Number(s.gross_salary || 0), 0);
              const totalTax = runSlips.reduce((acc, s) => acc + Number(s.tax_amount || 0), 0);
              const totalPension = runSlips.reduce((acc, s) => acc + Number(s.pension_amount || 0), 0);
              const totalNet = runSlips.reduce((acc, s) => acc + Number(s.net_pay || 0), 0);

              if (runSlips.length === 0) {
                return (
                  <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#90909a' }}>
                    <p style={{ margin: '0 0 .5rem', fontSize: '1.05rem', color: '#f0f0f2' }}>No payslips generated for this run yet</p>
                    <small>Click &quot;⚡ Calculate&quot; on the runs table to compute payslips for all eligible employees.</small>
                  </div>
                );
              }

              return (
                <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
                  {/* Summary Bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '.75rem', background: '#202025', padding: '.9rem 1.25rem', borderRadius: '.6rem' }}>
                    <div>
                      <small style={{ color: '#90909a' }}>Recipients</small>
                      <strong style={{ display: 'block', fontSize: '1.1rem' }}>{runSlips.length} employees</strong>
                    </div>
                    <div>
                      <small style={{ color: '#90909a' }}>Total Gross</small>
                      <strong style={{ display: 'block', fontSize: '1.1rem' }}>{formatETB(totalGross)}</strong>
                    </div>
                    <div>
                      <small style={{ color: '#ffd27a' }}>Total Tax (PIT)</small>
                      <strong style={{ display: 'block', fontSize: '1.1rem', color: '#ffd27a' }}>{formatETB(totalTax)}</strong>
                    </div>
                    <div>
                      <small style={{ color: '#ffd27a' }}>Total Pension (7%)</small>
                      <strong style={{ display: 'block', fontSize: '1.1rem', color: '#ffd27a' }}>{formatETB(totalPension)}</strong>
                    </div>
                    <div>
                      <small style={{ color: '#52d9a6' }}>Total Net Payout</small>
                      <strong style={{ display: 'block', fontSize: '1.1rem', color: '#52d9a6' }}>{formatETB(totalNet)}</strong>
                    </div>
                  </div>

                  {/* Slips Table */}
                  <div className="table-wrap" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Gross Salary</th>
                          <th>Tax (PIT)</th>
                          <th>Pension (7%)</th>
                          <th>Net Pay</th>
                          <th style={{ textAlign: 'right' }}>Voucher</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runSlips.map((slip) => {
                          const emp = employees.get(slip.employee_id);
                          const empName = emp ? `${emp.f_name} ${emp.l_name}`.trim() : `Employee #${slip.employee_id}`;
                          const deptName = emp?.dept_id ? departments.get(emp.dept_id) || 'General' : 'General';

                          return (
                            <tr key={slip.payslip_id}>
                              <td>
                                <strong>{empName}</strong>
                                <small style={{ display: 'block', color: '#90909a' }}>ID #{slip.employee_id}</small>
                              </td>
                              <td>{deptName}</td>
                              <td>{formatETB(slip.gross_salary)}</td>
                              <td style={{ color: '#ffd27a' }}>{formatETB(slip.tax_amount)}</td>
                              <td style={{ color: '#ffd27a' }}>{formatETB(slip.pension_amount || 0)}</td>
                              <td><strong style={{ color: '#52d9a6' }}>{formatETB(slip.net_pay)}</strong></td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className="button-secondary"
                                  onClick={() => setSelectedPayslipForVoucher(slip)}
                                  style={{ fontSize: '.75rem', padding: '.25rem .55rem' }}
                                >
                                  📄 Voucher
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="modal-actions" style={{ marginTop: '.5rem' }}>
                    <button className="button-secondary" onClick={() => setSelectedRunForDrilldown(null)}>
                      Close Details
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: OFFICIAL PAYSLIP VOUCHER (PRINTABLE)                    */}
      {/* ============================================================== */}
      {selectedPayslipForVoucher && (() => {
        const slip = selectedPayslipForVoucher;
        const emp = getEmployeeForPayslip(slip.employee_id);
        const empName = emp ? `${emp.f_name} ${emp.l_name}`.trim() : `Employee #${slip.employee_id}`;
        const deptName = emp?.dept_id ? departments.get(emp.dept_id) || 'Corporate' : 'Corporate';
        const jobTitle = emp?.job_id ? jobs.get(emp.job_id) || 'Staff Specialist' : 'Staff Specialist';

        const gross = Number(slip.gross_salary || 0);
        const tax = Number(slip.tax_amount || 0);
        const pension = Number(slip.pension_amount || 0);
        const totalDeductions = tax + pension;
        const net = Number(slip.net_pay || 0);

        return (
          <div className="modal-backdrop" onClick={() => setSelectedPayslipForVoucher(null)}>
            <div
              className="modal payslip-modal-container"
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(680px, 98%)', background: '#1c1c22', border: '1px solid #3b3b45' }}
            >
              {/* Voucher Action Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '.75rem', borderBottom: '1px solid #2d2d38' }}>
                <span className="eyebrow" style={{ margin: 0 }}>Official Salary Voucher</span>
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <button
                    className="button-secondary"
                    onClick={() => window.print()}
                    style={{ fontSize: '.8rem', padding: '.4rem .8rem' }}
                  >
                    🖨 Print / PDF
                  </button>
                  <button
                    className="button-link"
                    onClick={() => setSelectedPayslipForVoucher(null)}
                    style={{ color: '#90909a' }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Printable Body */}
              <div className="printable-payslip" style={{ padding: '.5rem', display: 'grid', gap: '1.25rem' }}>
                {/* Organization Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #7c6af0', paddingBottom: '1rem' }}>
                  <div>
                    <h2 style={{ margin: '0 0 .2rem', fontSize: '1.35rem', color: '#f0f0f2' }}>WorkForce HR Operations</h2>
                    <p style={{ margin: 0, fontSize: '.85rem', color: '#90909a' }}>Enterprise Human Capital & Payroll Management</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-approved" style={{ fontSize: '.8rem' }}>Verified Payslip</span>
                    <p style={{ margin: '.4rem 0 0', fontSize: '.8rem', color: '#90909a' }}>
                      Date: {formatDate(slip.created_at)}
                    </p>
                  </div>
                </div>

                {/* Employee Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.85rem', background: '#24242c', padding: '1rem', borderRadius: '.6rem', fontSize: '.85rem' }}>
                  <div>
                    <span style={{ color: '#90909a', display: 'block' }}>Employee Name</span>
                    <strong>{empName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#90909a', display: 'block' }}>Employee ID</span>
                    <strong>#{slip.employee_id}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#90909a', display: 'block' }}>Department</span>
                    <strong>{deptName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#90909a', display: 'block' }}>Job Title</span>
                    <strong>{jobTitle}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#90909a', display: 'block' }}>Payroll Run Ref</span>
                    <strong>Run #{slip.run_id}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#90909a', display: 'block' }}>Currency</span>
                    <strong>Ethiopian Birr (ETB)</strong>
                  </div>
                </div>

                {/* Earnings & Deductions Breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Earnings */}
                  <div style={{ background: '#202027', padding: '1rem', borderRadius: '.6rem' }}>
                    <h4 style={{ margin: '0 0 .75rem', fontSize: '.9rem', color: '#52d9a6', borderBottom: '1px solid #2d2d38', paddingBottom: '.4rem' }}>
                      Earnings & Allowances
                    </h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: '.4rem' }}>
                      <span>Base Salary</span>
                      <span>{formatETB(gross)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: '.4rem' }}>
                      <span>Adjustments / Bonus</span>
                      <span>0.00 ETB</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.95rem', fontWeight: 600, borderTop: '1px solid #2d2d38', paddingTop: '.5rem', marginTop: '.75rem' }}>
                      <span>Gross Earnings</span>
                      <span style={{ color: '#f0f0f2' }}>{formatETB(gross)}</span>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div style={{ background: '#202027', padding: '1rem', borderRadius: '.6rem' }}>
                    <h4 style={{ margin: '0 0 .75rem', fontSize: '.9rem', color: '#ffd27a', borderBottom: '1px solid #2d2d38', paddingBottom: '.4rem' }}>
                      Statutory Deductions
                    </h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: '.4rem' }}>
                      <span>Income Tax (PIT)</span>
                      <span style={{ color: '#ffd27a' }}>{formatETB(tax)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: '.4rem' }}>
                      <span>Employee Pension (7%)</span>
                      <span style={{ color: '#ffd27a' }}>{formatETB(pension)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.95rem', fontWeight: 600, borderTop: '1px solid #2d2d38', paddingTop: '.5rem', marginTop: '.75rem' }}>
                      <span>Total Deductions</span>
                      <span style={{ color: '#ffd27a' }}>{formatETB(totalDeductions)}</span>
                    </div>
                  </div>
                </div>

                {/* Net Pay Callout */}
                <div style={{ background: 'linear-gradient(135deg, rgba(82, 217, 166, 0.12), rgba(124, 106, 240, 0.15))', border: '1px solid rgba(82, 217, 166, 0.4)', borderRadius: '.75rem', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.05em', color: '#52d9a6', fontWeight: 600 }}>
                      Net Take-Home Pay
                    </span>
                    <small style={{ display: 'block', color: '#90909a' }}>Transferred to registered employee salary account</small>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: '1.8rem', color: '#52d9a6', fontWeight: 700 }}>
                      {formatETB(net)}
                    </strong>
                  </div>
                </div>

                {/* Footer Stamp */}
                <div style={{ textAlign: 'center', fontSize: '.75rem', color: '#686873', borderTop: '1px dashed #2d2d38', paddingTop: '.75rem' }}>
                  This is a confidential computer-generated document authorized by WorkForce HR Operations. No signature required.
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
