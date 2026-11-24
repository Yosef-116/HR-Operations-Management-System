import { useCallback, useEffect, useMemo, useState } from 'react';
import { request } from '../../api';
import { useAuth } from '../../auth';
import type { ReportsOverview } from '../../types';

type PeriodPreset = 'all' | 'ytd' | '12m' | '90d' | 'custom';
type ReportTab = 'executive' | 'workforce' | 'financial' | 'operations';

function formatETB(value: number | null | undefined): string {
  const num = Number(value || 0);
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

function formatUSD(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

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

function escapeCsvCell(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(','))
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getPresetDates(preset: Exclude<PeriodPreset, 'custom'>): { start: string; end: string } {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);

  if (preset === 'all') return { start: '', end: '' };
  if (preset === 'ytd') {
    return { start: `${today.getFullYear()}-01-01`, end };
  }
  if (preset === '12m') {
    const start = new Date(today);
    start.setFullYear(start.getFullYear() - 1);
    return { start: start.toISOString().slice(0, 10), end };
  }
  const start = new Date(today);
  start.setDate(start.getDate() - 90);
  return { start: start.toISOString().slice(0, 10), end };
}

export function ReportsPage() {
  const { user } = useAuth();
  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [activeTab, setActiveTab] = useState<ReportTab>('executive');

  const [data, setData] = useState<ReportsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canAccessReports = useMemo(() => {
    if (!user) return false;
    if (user.roles?.includes('Admin') || user.permissions?.includes('manage_all')) return true;
    return user.permissions?.some((p) =>
      ['view_reports', 'view_org', 'view_payroll', 'manage_payroll', 'process_payroll', 'manage_org'].includes(p)
    );
  }, [user]);

  const loadReports = useCallback(async () => {
    if (!canAccessReports) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (appliedRange.start) params.set('start_date', appliedRange.start);
      if (appliedRange.end) params.set('end_date', appliedRange.end);
      const qs = params.toString();
      const res = await request<ReportsOverview>(`/reports/overview${qs ? `?${qs}` : ''}`);
      setData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load executive analytics');
    } finally {
      setLoading(false);
    }
  }, [canAccessReports, appliedRange]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handlePresetChange = (nextPreset: PeriodPreset) => {
    setPreset(nextPreset);
    if (nextPreset === 'custom') return;
    const range = getPresetDates(nextPreset);
    setStartDate(range.start);
    setEndDate(range.end);
    setAppliedRange(range);
  };

  const handleApplyCustom = () => {
    if (startDate && endDate && startDate > endDate) {
      setError('Start date cannot be after end date.');
      return;
    }
    setAppliedRange({ start: startDate, end: endDate });
  };

  const handlePrint = () => {
    document.body.classList.add('printing-report');
    const cleanup = () => {
      document.body.classList.remove('printing-report');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    // Fallback cleanup for browsers that do not fire afterprint synchronously
    setTimeout(cleanup, 1000);
  };

  const maxDeptHeadcount = useMemo(() => {
    if (!data?.workforce.departments.length) return 1;
    return Math.max(1, ...data.workforce.departments.map((d) => d.total_headcount));
  }, [data]);

  const maxLeaveDays = useMemo(() => {
    if (!data?.leave_and_attendance.by_type.length) return 1;
    return Math.max(1, ...data.leave_and_attendance.by_type.map((l) => l.approved_days));
  }, [data]);

  const assetTotals = useMemo(() => {
    const list = data?.assets.by_type || [];
    return list.reduce(
      (acc, row) => ({
        total: acc.total + row.total_count,
        assigned: acc.assigned + row.assigned_count,
        available: acc.available + row.available_count,
        maintenance: acc.maintenance + row.maintenance_count,
        retired: acc.retired + row.retired_count
      }),
      { total: 0, assigned: 0, available: 0, maintenance: 0, retired: 0 }
    );
  }, [data]);

  if (!canAccessReports) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <h2>Restricted Access</h2>
        <p style={{ color: '#9898a8' }}>
          Executive analytics and HR reporting require management, HR, or payroll viewer permissions.
        </p>
      </div>
    );
  }

  const periodBadgeLabel = appliedRange.start || appliedRange.end
    ? `${appliedRange.start || 'Start'} → ${appliedRange.end || 'Present'}`
    : 'All Time';

  return (
    <div className="reports-page" style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Header & Global Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="eyebrow">Executive Intelligence & Compliance</span>
          <h1 style={{ margin: '0.2rem 0', fontSize: '1.8rem', fontWeight: 700 }}>
            HR Analytics & Reporting
          </h1>
          <p style={{ margin: 0, color: '#9898a8', fontSize: '0.9rem' }}>
            Real-time organizational headcount, attrition, payroll expenditure, leave utilization, and operational health ·{' '}
            <strong style={{ color: '#c8c0ff' }}>{periodBadgeLabel}</strong>
          </p>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button"
            onClick={() => void loadReports()}
            disabled={loading}
          >
            ↻ Refresh
          </button>
          <button
            type="button"
            className="button primary"
            onClick={handlePrint}
            disabled={!data || loading}
          >
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>

      {/* Date Range Filter Toolbar */}
      <section className="card no-print" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="eyebrow" style={{ marginRight: '0.25rem' }}>Window:</span>
            {(
              [
                ['all', 'All Time'],
                ['ytd', 'Year to Date'],
                ['12m', 'Last 12 Months'],
                ['90d', 'Last 90 Days'],
                ['custom', 'Custom Range']
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`subnav-tab ${preset === key ? 'active' : ''}`}
                onClick={() => handlePresetChange(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="date"
                aria-label="Report start date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: 'auto' }}
              />
              <span style={{ color: '#9898a8' }}>to</span>
              <input
                type="date"
                aria-label="Report end date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: 'auto' }}
              />
              <button type="button" className="button primary" onClick={handleApplyCustom}>
                Apply
              </button>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 0, color: 'inherit', fontSize: '1.2rem' }}>×</button>
        </div>
      )}

      {loading && !data ? (
        <div className="card">
          <p className="loading-cell">Aggregating enterprise HR reports…</p>
        </div>
      ) : data ? (
        <>
          {/* Executive KPI Strip */}
          <div className="stats-grid" style={{ margin: 0 }}>
            <article className="stat-card">
              <span>Active Workforce</span>
              <strong>{data.workforce.active_employees}</strong>
              <small>
                {data.workforce.total_employees} total · {data.workforce.new_hires} new hire{data.workforce.new_hires === 1 ? '' : 's'}
              </small>
            </article>

            <article className="stat-card">
              <span>Attrition Rate</span>
              <strong style={{ color: data.workforce.attrition_rate > 15 ? '#ff9494' : '#ffd27a' }}>
                {data.workforce.attrition_rate}%
              </strong>
              <small>
                {data.lifecycle.exits.total_exits} exit{data.lifecycle.exits.total_exits === 1 ? '' : 's'} ·{' '}
                {data.lifecycle.exits.pending_clearance} pending clearance
              </small>
            </article>

            {data.payroll ? (
              <article className="stat-card">
                <span>Net Payroll Disbursed</span>
                <strong style={{ fontSize: '1.55rem', color: '#8fe3b6' }}>
                  {formatETB(data.payroll.summary.total_net)}
                </strong>
                <small>
                  {data.payroll.summary.total_runs} run{data.payroll.summary.total_runs === 1 ? '' : 's'} ·{' '}
                  {data.payroll.summary.payslip_count} payslips
                </small>
              </article>
            ) : (
              <article className="stat-card">
                <span>Attendance Average</span>
                <strong style={{ color: '#8fe3b6' }}>{data.leave_and_attendance.avg_daily_hours} hrs</strong>
                <small>{data.leave_and_attendance.attendance_logs} logged shifts</small>
              </article>
            )}

            <article className="stat-card">
              <span>Asset Fleet Utilization</span>
              <strong style={{ color: '#b7a9ff' }}>
                {assetTotals.total > 0 ? Math.round((assetTotals.assigned / assetTotals.total) * 100) : 0}%
              </strong>
              <small>
                {assetTotals.assigned} assigned of {assetTotals.total} tracked assets
              </small>
            </article>
          </div>

          {/* Domain Tabs */}
          <div className="subnav-tabs no-print" style={{ borderBottom: '1px solid #29292f', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`subnav-tab ${activeTab === 'executive' ? 'active' : ''}`}
              onClick={() => setActiveTab('executive')}
            >
              📊 Executive Briefing
            </button>
            <button
              type="button"
              className={`subnav-tab ${activeTab === 'workforce' ? 'active' : ''}`}
              onClick={() => setActiveTab('workforce')}
            >
              👥 Workforce & Attrition ({data.workforce.departments.length} depts)
            </button>
            {data.payroll && (
              <button
                type="button"
                className={`subnav-tab ${activeTab === 'financial' ? 'active' : ''}`}
                onClick={() => setActiveTab('financial')}
              >
                💰 Payroll & Expenses
              </button>
            )}
            <button
              type="button"
              className={`subnav-tab ${activeTab === 'operations' ? 'active' : ''}`}
              onClick={() => setActiveTab('operations')}
            >
              ⚙️ Leave, Assets & Compliance
            </button>
          </div>

          {/* ============================================================== */}
          {/* VIEW 1: EXECUTIVE BRIEFING                                     */}
          {/* ============================================================== */}
          {activeTab === 'executive' && (
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              <div className="report-grid-2">
                {/* Headcount by Department Bar Chart */}
                <section className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h2 style={{ margin: 0 }}>Headcount by Department</h2>
                      <small style={{ color: '#9898a8' }}>Active vs total staffing distribution</small>
                    </div>
                    <button
                      type="button"
                      className="button btn-sm no-print"
                      onClick={() =>
                        downloadCsv(
                          'department_headcount_report.csv',
                          ['Department', 'Office', 'Active Headcount', 'Total Headcount', ...(data.payroll ? ['Monthly Salary Commitment (ETB)'] : [])],
                          data.workforce.departments.map((d) => [
                            d.dept_name,
                            d.office_name,
                            d.active_headcount,
                            d.total_headcount,
                            ...(data.payroll ? [d.monthly_payroll_commitment ?? 0] : [])
                          ])
                        )
                      }
                    >
                      ⬇ Export CSV
                    </button>
                  </div>

                  {data.workforce.departments.length === 0 ? (
                    <p className="loading-cell" style={{ padding: '1.5rem' }}>No department data found.</p>
                  ) : (
                    <div className="bar-list">
                      {data.workforce.departments.map((d) => {
                        const pct = Math.round((d.total_headcount / maxDeptHeadcount) * 100);
                        return (
                          <div key={d.dept_id} className="bar-row">
                            <div className="bar-meta">
                              <span>
                                <strong>{d.dept_name}</strong>{' '}
                                <small>({d.office_name})</small>
                              </span>
                              <span>
                                <strong>{d.active_headcount}</strong> active / {d.total_headcount}
                              </span>
                            </div>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Leave Utilization Visual */}
                <section className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h2 style={{ margin: 0 }}>Leave Utilization Breakdown</h2>
                      <small style={{ color: '#9898a8' }}>Approved leave days by policy type</small>
                    </div>
                    <button
                      type="button"
                      className="button btn-sm no-print"
                      onClick={() =>
                        downloadCsv(
                          'leave_utilization_report.csv',
                          ['Leave Type', 'Paid', 'Total Requests', 'Approved Requests', 'Pending', 'Rejected', 'Approved Days'],
                          data.leave_and_attendance.by_type.map((l) => [
                            l.type_name,
                            l.is_paid ? 'Yes' : 'No',
                            l.total_requests,
                            l.approved_requests,
                            l.pending_requests,
                            l.rejected_requests,
                            l.approved_days
                          ])
                        )
                      }
                    >
                      ⬇ Export CSV
                    </button>
                  </div>

                  {data.leave_and_attendance.by_type.length === 0 ? (
                    <p className="loading-cell" style={{ padding: '1.5rem' }}>No leave policy records found.</p>
                  ) : (
                    <div className="bar-list">
                      {data.leave_and_attendance.by_type.map((l) => {
                        const pct = Math.round((l.approved_days / maxLeaveDays) * 100);
                        return (
                          <div key={l.type_name} className="bar-row">
                            <div className="bar-meta">
                              <span>
                                <strong>{l.type_name}</strong>{' '}
                                <small>{l.is_paid ? 'Paid' : 'Unpaid'}</small>
                              </span>
                              <span>
                                <strong>{l.approved_days}</strong> days ({l.pending_requests} pending)
                              </span>
                            </div>
                            <div className="bar-track">
                              <div
                                className="bar-fill"
                                style={{
                                  width: `${pct}%`,
                                  background: l.is_paid
                                    ? 'linear-gradient(90deg, #3ecf8e, #8fe3b6)'
                                    : 'linear-gradient(90deg, #f5a623, #ffd27a)'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              {/* Lifecycle & Operations Snapshot */}
              <div className="report-grid-2">
                {/* Onboarding & Offboarding Health */}
                <section className="card">
                  <h2>Onboarding & Lifecycle Health</h2>
                  <div className="info-grid" style={{ marginTop: '0.75rem' }}>
                    <div className="info-field">
                      <span className="info-label">Onboarding Completion</span>
                      <span className="info-val" style={{ color: '#8fe3b6', fontSize: '1.15rem' }}>
                        {data.lifecycle.onboarding.task_completion_rate}%
                      </span>
                      <small style={{ color: '#9898a8' }}>
                        {data.lifecycle.onboarding.completed_tasks}/{data.lifecycle.onboarding.total_tasks} tasks complete
                      </small>
                    </div>
                    <div className="info-field">
                      <span className="info-label">Active Onboarding Tracks</span>
                      <span className="info-val" style={{ fontSize: '1.15rem' }}>
                        {data.lifecycle.onboarding.in_progress_checklists}
                      </span>
                      <small style={{ color: '#9898a8' }}>
                        {data.lifecycle.onboarding.completed_checklists} completed total
                      </small>
                    </div>
                    <div className="info-field">
                      <span className="info-label">Avg Daily Shift Length</span>
                      <span className="info-val" style={{ fontSize: '1.15rem' }}>
                        {data.leave_and_attendance.avg_daily_hours} hrs
                      </span>
                      <small style={{ color: '#9898a8' }}>
                        {data.leave_and_attendance.attendance_logs} logs in range
                      </small>
                    </div>
                    <div className="info-field">
                      <span className="info-label">Approved Overtime</span>
                      <span className="info-val" style={{ fontSize: '1.15rem', color: '#ffd27a' }}>
                        {data.leave_and_attendance.approved_overtime_hours} hrs
                      </span>
                      <small style={{ color: '#9898a8' }}>Approved & paid records</small>
                    </div>
                  </div>
                </section>

                {/* Payroll & Governance Snapshot */}
                <section className="card">
                  <h2>{data.payroll ? 'Financial & Compliance Snapshot' : 'Compliance & Asset Snapshot'}</h2>
                  <div className="info-grid" style={{ marginTop: '0.75rem' }}>
                    {data.payroll && (
                      <>
                        <div className="info-field">
                          <span className="info-label">Gross Payroll Volume</span>
                          <span className="info-val" style={{ color: '#c8c0ff' }}>
                            {formatETB(data.payroll.summary.total_gross)}
                          </span>
                          <small style={{ color: '#9898a8' }}>
                            Avg net: {formatETB(data.payroll.summary.avg_net_pay)}
                          </small>
                        </div>
                        <div className="info-field">
                          <span className="info-label">Tax + Pension Withheld</span>
                          <span className="info-val">
                            {formatETB(data.payroll.summary.total_tax + data.payroll.summary.total_pension)}
                          </span>
                          <small style={{ color: '#9898a8' }}>
                            Tax {formatETB(data.payroll.summary.total_tax)}
                          </small>
                        </div>
                      </>
                    )}
                    <div className="info-field">
                      <span className="info-label">Asset Fleet Status</span>
                      <span className="info-val">
                        {assetTotals.assigned} assigned · {assetTotals.available} ready
                      </span>
                      <small style={{ color: '#9898a8' }}>
                        {assetTotals.maintenance} in maintenance
                      </small>
                    </div>
                    {data.grievances ? (
                      <div className="info-field">
                        <span className="info-label">Grievance Case Posture</span>
                        <span className="info-val" style={{ color: data.grievances.open_cases > 0 ? '#ff9494' : '#8fe3b6' }}>
                          {data.grievances.open_cases} open / {data.grievances.closed_cases} closed
                        </span>
                        <small style={{ color: '#9898a8' }}>
                          {data.grievances.active_cases} under investigation
                        </small>
                      </div>
                    ) : (
                      <div className="info-field">
                        <span className="info-label">Exit Clearance Progress</span>
                        <span className="info-val">
                          {data.lifecycle.exits.cleared_exits} cleared / {data.lifecycle.exits.total_exits} total
                        </span>
                        <small style={{ color: '#9898a8' }}>
                          {data.lifecycle.exits.pending_clearance} pending clearance
                        </small>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW 2: WORKFORCE & ATTRITION                                  */}
          {/* ============================================================== */}
          {activeTab === 'workforce' && (
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              <section className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>Departmental Staffing & Salary Allocation</h2>
                    <small style={{ color: '#9898a8' }}>Breakdown of employees and monthly active base contract commitments</small>
                  </div>
                  <button
                    type="button"
                    className="button btn-sm no-print"
                    onClick={() =>
                      downloadCsv(
                        'department_staffing_report.csv',
                        ['Department', 'Office', 'Active Headcount', 'Total Headcount', ...(data.payroll ? ['Monthly Base Commitment (ETB)'] : [])],
                        data.workforce.departments.map((d) => [
                          d.dept_name,
                          d.office_name,
                          d.active_headcount,
                          d.total_headcount,
                          ...(data.payroll ? [d.monthly_payroll_commitment ?? 0] : [])
                        ])
                      )
                    }
                  >
                    ⬇ Export CSV
                  </button>
                </div>

                <div className="table-card" style={{ border: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Office Location</th>
                        <th>Active Employees</th>
                        <th>Total Assigned</th>
                        {data.payroll && <th>Active Contract Base (Monthly)</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {data.workforce.departments.map((d) => (
                        <tr key={d.dept_id}>
                          <td><strong>{d.dept_name}</strong></td>
                          <td>{d.office_name}</td>
                          <td><span className="status active">{d.active_headcount}</span></td>
                          <td>{d.total_headcount}</td>
                          {data.payroll && (
                            <td><strong>{formatETB(d.monthly_payroll_commitment)}</strong></td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="report-grid-2">
                {/* Office Distribution */}
                <section className="card">
                  <h2>Workforce by Office Site</h2>
                  <div className="table-card" style={{ border: 0, marginTop: '0.5rem' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Office</th>
                          <th>City</th>
                          <th>Active</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.workforce.offices.map((o) => (
                          <tr key={o.office_id}>
                            <td><strong>{o.location_name}</strong></td>
                            <td>{o.city}</td>
                            <td>{o.active_headcount}</td>
                            <td>{o.total_headcount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Demographics & Exit Breakdown */}
                <section className="card">
                  <h2>Demographics & Exit Reasons</h2>
                  <div style={{ display: 'grid', gap: '1.1rem', marginTop: '0.75rem' }}>
                    <div>
                      <span className="eyebrow" style={{ fontSize: '0.75rem' }}>Active Workforce Gender Split</span>
                      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        {data.workforce.demographics.map((d) => (
                          <span key={d.label} className="badge-type" style={{ padding: '0.35rem 0.7rem' }}>
                            {d.label}: <strong>{d.count}</strong>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="eyebrow" style={{ fontSize: '0.75rem' }}>Exits by Category ({data.lifecycle.exits.total_exits})</span>
                      {data.lifecycle.exits.by_type.length === 0 ? (
                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.88rem', color: '#9898a8' }}>
                          No employee exits recorded in the selected window.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                          {data.lifecycle.exits.by_type.map((ex) => (
                            <span key={ex.exit_type} className="badge badge-open">
                              {ex.exit_type}: {ex.count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW 3: PAYROLL & EXPENSES                                     */}
          {/* ============================================================== */}
          {activeTab === 'financial' && data.payroll && (
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              {/* Payroll Runs Ledger */}
              <section className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>Payroll Runs Ledger</h2>
                    <small style={{ color: '#9898a8' }}>Gross salary, income tax, pension, and net disbursement by payroll cycle</small>
                  </div>
                  <button
                    type="button"
                    className="button btn-sm no-print"
                    onClick={() =>
                      downloadCsv(
                        'payroll_runs_report.csv',
                        ['Run ID', 'Run Date', 'Status', 'Payslips', 'Gross (ETB)', 'Tax (ETB)', 'Pension (ETB)', 'Net Pay (ETB)'],
                        data.payroll!.runs.map((r) => [
                          r.run_id,
                          r.run_date.slice(0, 10),
                          r.status,
                          r.payslip_count,
                          r.total_gross,
                          r.total_tax,
                          r.total_pension,
                          r.total_net
                        ])
                      )
                    }
                  >
                    ⬇ Export CSV
                  </button>
                </div>

                {data.payroll.runs.length === 0 ? (
                  <p className="loading-cell" style={{ padding: '2rem' }}>No payroll runs found for this period.</p>
                ) : (
                  <div className="table-card" style={{ border: 0 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Run</th>
                          <th>Run Date</th>
                          <th>Status</th>
                          <th>Payslips</th>
                          <th>Gross Pay</th>
                          <th>Tax Withheld</th>
                          <th>Pension</th>
                          <th>Net Disbursed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.payroll.runs.map((run) => (
                          <tr key={run.run_id}>
                            <td><strong>#{run.run_id}</strong></td>
                            <td>{formatDate(run.run_date)}</td>
                            <td>
                              <span
                                className={`badge ${
                                  run.status === 'Processed' || run.status === 'Approved'
                                    ? 'badge-approved'
                                    : 'badge-draft'
                                }`}
                              >
                                {run.status}
                              </span>
                            </td>
                            <td>{run.payslip_count}</td>
                            <td>{formatETB(run.total_gross)}</td>
                            <td style={{ color: '#ffd27a' }}>{formatETB(run.total_tax)}</td>
                            <td>{formatETB(run.total_pension)}</td>
                            <td><strong style={{ color: '#8fe3b6' }}>{formatETB(run.total_net)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Expense Claims by Category */}
              <section className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>Expense Claims by Category</h2>
                    <small style={{ color: '#9898a8' }}>Submitted vs approved/paid reimbursements</small>
                  </div>
                  <button
                    type="button"
                    className="button btn-sm no-print"
                    onClick={() =>
                      downloadCsv(
                        'expense_category_report.csv',
                        ['Category', 'Claim Count', 'Total Submitted (USD)', 'Approved/Paid (USD)', 'Pending (USD)'],
                        data.payroll!.expenses_by_category.map((c) => [
                          c.category,
                          c.claim_count,
                          c.total_amount,
                          c.approved_amount,
                          c.pending_amount
                        ])
                      )
                    }
                  >
                    ⬇ Export CSV
                  </button>
                </div>

                {data.payroll.expenses_by_category.length === 0 ? (
                  <p className="loading-cell" style={{ padding: '2rem' }}>No expense claims logged in this window.</p>
                ) : (
                  <div className="table-card" style={{ border: 0 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Claims</th>
                          <th>Total Submitted</th>
                          <th>Approved / Paid</th>
                          <th>Pending Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.payroll.expenses_by_category.map((exp) => (
                          <tr key={exp.category}>
                            <td><span className="badge-type">{exp.category}</span></td>
                            <td>{exp.claim_count}</td>
                            <td><strong>{formatUSD(exp.total_amount)}</strong></td>
                            <td style={{ color: '#8fe3b6' }}>{formatUSD(exp.approved_amount)}</td>
                            <td style={{ color: '#ffd27a' }}>{formatUSD(exp.pending_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW 4: LEAVE, ASSETS & COMPLIANCE                             */}
          {/* ============================================================== */}
          {activeTab === 'operations' && (
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              {/* Leave Policy Table */}
              <section className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>Leave Policy Utilization</h2>
                    <small style={{ color: '#9898a8' }}>Approved calendar days and request decision counts</small>
                  </div>
                  <button
                    type="button"
                    className="button btn-sm no-print"
                    onClick={() =>
                      downloadCsv(
                        'leave_policy_report.csv',
                        ['Policy Type', 'Paid', 'Total Requests', 'Approved', 'Pending', 'Rejected', 'Approved Days'],
                        data.leave_and_attendance.by_type.map((l) => [
                          l.type_name,
                          l.is_paid ? 'Paid' : 'Unpaid',
                          l.total_requests,
                          l.approved_requests,
                          l.pending_requests,
                          l.rejected_requests,
                          l.approved_days
                        ])
                      )
                    }
                  >
                    ⬇ Export CSV
                  </button>
                </div>

                <div className="table-card" style={{ border: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Leave Type</th>
                        <th>Compensation</th>
                        <th>Requests</th>
                        <th>Approved</th>
                        <th>Pending</th>
                        <th>Rejected</th>
                        <th>Approved Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leave_and_attendance.by_type.map((l) => (
                        <tr key={l.type_name}>
                          <td><strong>{l.type_name}</strong></td>
                          <td>
                            <span className={`badge ${l.is_paid ? 'badge-approved' : 'badge-draft'}`}>
                              {l.is_paid ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td>{l.total_requests}</td>
                          <td style={{ color: '#8fe3b6' }}>{l.approved_requests}</td>
                          <td style={{ color: '#ffd27a' }}>{l.pending_requests}</td>
                          <td style={{ color: '#ff9494' }}>{l.rejected_requests}</td>
                          <td><strong>{l.approved_days}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Asset Fleet Health Table */}
              <section className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>Company Asset Fleet Breakdown</h2>
                    <small style={{ color: '#9898a8' }}>Current hardware custody and maintenance status by equipment category</small>
                  </div>
                  <button
                    type="button"
                    className="button btn-sm no-print"
                    onClick={() =>
                      downloadCsv(
                        'asset_fleet_report.csv',
                        ['Asset Type', 'Total', 'Assigned', 'Available', 'Maintenance', 'Retired'],
                        data.assets.by_type.map((a) => [
                          a.asset_type,
                          a.total_count,
                          a.assigned_count,
                          a.available_count,
                          a.maintenance_count,
                          a.retired_count
                        ])
                      )
                    }
                  >
                    ⬇ Export CSV
                  </button>
                </div>

                {data.assets.by_type.length === 0 ? (
                  <p className="loading-cell" style={{ padding: '2rem' }}>No registered company assets found.</p>
                ) : (
                  <div className="table-card" style={{ border: 0 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Asset Type</th>
                          <th>Total</th>
                          <th>Assigned</th>
                          <th>Available</th>
                          <th>Maintenance</th>
                          <th>Retired</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.assets.by_type.map((a) => (
                          <tr key={a.asset_type}>
                            <td><strong>{a.asset_type}</strong></td>
                            <td>{a.total_count}</td>
                            <td style={{ color: '#c8c0ff' }}>{a.assigned_count}</td>
                            <td style={{ color: '#8fe3b6' }}>{a.available_count}</td>
                            <td style={{ color: '#ffd27a' }}>{a.maintenance_count}</td>
                            <td style={{ color: '#9898a8' }}>{a.retired_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Grievance Summary by Category (HR / Resolvers only) */}
              {data.grievances && (
                <section className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h2 style={{ margin: 0 }}>Workplace Grievance Trends</h2>
                      <small style={{ color: '#9898a8' }}>Aggregated case volume & closure count by category (confidential narratives omitted)</small>
                    </div>
                  </div>

                  {data.grievances.by_category.length === 0 ? (
                    <p className="loading-cell" style={{ padding: '2rem' }}>No grievance cases filed during this window.</p>
                  ) : (
                    <div className="table-card" style={{ border: 0 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Concern Category</th>
                            <th>Total Cases</th>
                            <th>Closed (Resolved / Dismissed)</th>
                            <th>Active / Open</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.grievances.by_category.map((g) => (
                            <tr key={g.category}>
                              <td><span className="badge-type">{g.category}</span></td>
                              <td><strong>{g.count}</strong></td>
                              <td style={{ color: '#8fe3b6' }}>{g.closed_count}</td>
                              <td style={{ color: '#ffd27a' }}>{g.count - g.closed_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
