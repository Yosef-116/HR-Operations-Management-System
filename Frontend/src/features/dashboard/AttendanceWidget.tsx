import { useEffect, useState } from 'react';
import { ApiError, request } from '../../api';
import { useAuth } from '../../auth';
import type { AttendanceRecord } from '../../types';

export function AttendanceWidget() {
  const { user } = useAuth();
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [locationType, setLocationType] = useState<'Office' | 'Remote'>('Office');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(new Date());

  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);

  const loadAttendance = async () => {
    if (!user?.employee_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await request<AttendanceRecord[]>('/data/org/attendance?limit=7');
      const records = res.data || [];
      setHistory(records);

      const foundToday = records.find((r) => r.date?.slice(0, 10) === todayStr);
      setTodayRecord(foundToday || null);
      if (foundToday?.location_type) {
        setLocationType(foundToday.location_type === 'Remote' ? 'Remote' : 'Office');
      }
    } catch {
      // Ignored or scoped
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAttendance();
  }, [user?.employee_id]);

  const handleClockIn = async () => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await request('/workflows/attendance/clock-in', {
        method: 'POST',
        body: JSON.stringify({ location_type: locationType })
      });
      setSuccess('Successfully clocked in! Have a productive day.');
      await loadAttendance();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Failed to clock in');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await request('/workflows/attendance/clock-out', {
        method: 'POST',
        body: JSON.stringify({})
      });
      setSuccess('Clocked out successfully! Shift recorded.');
      await loadAttendance();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Failed to clock out');
    } finally {
      setActionLoading(false);
    }
  };

  const isClockedIn = Boolean(todayRecord && todayRecord.check_in && !todayRecord.check_out);
  const isShiftDone = Boolean(todayRecord && todayRecord.check_out);

  // Compute live elapsed time if clocked in
  const getElapsedString = () => {
    if (!isClockedIn || !todayRecord?.check_in) return null;
    const [h, m] = todayRecord.check_in.split(':').map(Number);
    const inDate = new Date();
    inDate.setHours(h, m, 0, 0);
    const diffMs = Math.max(0, now.getTime() - inDate.getTime());
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  };

  const elapsed = getElapsedString();

  return (
    <section className="card attendance-card" style={{ marginBottom: '1.5rem' }}>
      <div className="attendance-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Daily Attendance & Time Clock</h2>
          <small style={{ color: '#9898a8' }}>
            {now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </small>
        </div>
        <div className="live-clock">
          <span className="live-clock-time">{now.toLocaleTimeString()}</span>
          <span className="live-clock-badge">LIVE</span>
        </div>
      </div>

      {error && <p className="form-error" style={{ margin: '1rem 0' }} role="alert">{error}</p>}
      {success && <p className="form-success" style={{ margin: '1rem 0' }} role="status">{success}</p>}

      <div className="attendance-body">
        {/* Left Column: CTA & Location Selector */}
        <div className="attendance-cta-col">
          {!isClockedIn && !isShiftDone && (
            <div className="location-picker">
              <span className="info-label" style={{ marginBottom: '.35rem' }}>Work Location</span>
              <div className="tab-group" style={{ margin: 0 }}>
                <button
                  type="button"
                  className={`tab-btn${locationType === 'Office' ? ' active' : ''}`}
                  onClick={() => setLocationType('Office')}
                >
                  🏢 Office
                </button>
                <button
                  type="button"
                  className={`tab-btn${locationType === 'Remote' ? ' active' : ''}`}
                  onClick={() => setLocationType('Remote')}
                >
                  🏠 Remote
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            {loading ? (
              <button type="button" className="button" disabled style={{ padding: '.8rem 1.4rem' }}>
                Loading attendance…
              </button>
            ) : isClockedIn ? (
              <button
                type="button"
                className="button btn-danger btn-clock"
                disabled={actionLoading}
                onClick={handleClockOut}
              >
                {actionLoading ? 'Clocking Out…' : '⏹ Clock Out'}
              </button>
            ) : isShiftDone ? (
              <div className="shift-done-box">
                <span style={{ fontSize: '1.25rem' }}>✓</span>
                <div>
                  <strong>Today's Shift Completed</strong>
                  <small style={{ display: 'block', color: '#9898a8' }}>Total: {Number(todayRecord?.total_hours || 0).toFixed(1)} hours logged</small>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="button primary btn-clock"
                disabled={actionLoading}
                onClick={handleClockIn}
              >
                {actionLoading ? 'Clocking In…' : `▶ Clock In (${locationType})`}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Status Summary */}
        <div className="attendance-status-col">
          <div className="info-grid">
            <div className="info-field">
              <span className="info-label">Today's Status</span>
              <span className="info-val">
                {isClockedIn ? (
                  <span className="status status-approved" style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}>
                    <span className="pulse-dot" /> Working ({todayRecord?.location_type})
                  </span>
                ) : isShiftDone ? (
                  <span className="status status-completed">Completed</span>
                ) : (
                  <span className="status status-pending">Not Checked In</span>
                )}
              </span>
            </div>

            <div className="info-field">
              <span className="info-label">{isClockedIn ? 'Time Elapsed' : 'Total Hours'}</span>
              <span className="info-val" style={{ fontSize: '1.15rem', color: isClockedIn ? '#8fe3b6' : '#f0f0f2' }}>
                {isClockedIn ? elapsed : (todayRecord?.total_hours ? `${Number(todayRecord.total_hours).toFixed(2)} hrs` : '0.0 hrs')}
              </span>
            </div>

            <div className="info-field">
              <span className="info-label">Check-in Time</span>
              <span className="info-val">{todayRecord?.check_in ? todayRecord.check_in.slice(0, 5) : '—'}</span>
            </div>

            <div className="info-field">
              <span className="info-label">Check-out Time</span>
              <span className="info-val">{todayRecord?.check_out ? todayRecord.check_out.slice(0, 5) : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mini Recent Log */}
      {history.length > 0 && (
        <div className="attendance-history-section">
          <h4 style={{ margin: '1rem 0 .5rem', fontSize: '.8rem', color: '#8e8ea0', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Recent Attendance Log
          </h4>
          <div className="table-card" style={{ border: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Total Time</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 5).map((r) => (
                  <tr key={r.attendance_id}>
                    <td><strong>{r.date?.slice(0, 10)}</strong></td>
                    <td>{r.check_in ? r.check_in.slice(0, 5) : '—'}</td>
                    <td>{r.check_out ? r.check_out.slice(0, 5) : '—'}</td>
                    <td>{r.total_hours ? `${Number(r.total_hours).toFixed(1)} hrs` : (r.check_in && !r.check_out ? 'In progress' : '—')}</td>
                    <td><span className="badge-type">{r.location_type || 'Office'}</span></td>
                    <td><span className={`status status-${r.status.toLowerCase()}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

