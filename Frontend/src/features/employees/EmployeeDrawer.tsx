import { FormEvent, useEffect, useState } from 'react';
import { ApiError, request } from '../../api';
import { useAuth } from '../../auth';
import type { Department, EmergencyContact, Employee, EmployeeAddress, EmployeePhone, JobTitle, Office } from '../../types';

type Props = {
  employeeId: number | null;
  onClose: () => void;
  onUpdated: () => void;
  departments: Department[];
  jobs: JobTitle[];
  offices: Office[];
  allEmployees: Employee[];
};

export function EmployeeDrawer({
  employeeId,
  onClose,
  onUpdated,
  departments,
  jobs,
  offices,
  allEmployees
}: Props) {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [phone, setPhone] = useState<EmployeePhone | null>(null);
  const [address, setAddress] = useState<EmployeeAddress | null>(null);
  const [emergency, setEmergency] = useState<EmergencyContact | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [form, setForm] = useState({
    f_name: '',
    l_name: '',
    email: '',
    dept_id: '',
    job_id: '',
    office_id: '',
    manager_id: '',
    employment_status: 'Active',
    hire_date: '',
    gender: '',
    birth_date: '',
    national_id: '',
    nationality: '',
    phone_number: '',
    address_line: '',
    city: '',
    emergency_name: '',
    emergency_phone: ''
  });

  const isSelf = Boolean(user?.employee_id && user.employee_id === employeeId);
  const isAdminOrHR = Boolean(user?.permissions.includes('manage_all') || user?.permissions.includes('manage_org'));
  const canEditWork = isAdminOrHR;
  const canEditContact = isAdminOrHR || isSelf;

  useEffect(() => {
    if (!employeeId) return;

    let active = true;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setIsEditing(false);

    const loadData = async () => {
      try {
        const [empRes, phoneRes, addrRes, emgRes] = await Promise.all([
          request<Employee>(`/data/org/employee/${employeeId}`),
          request<EmployeePhone[]>(`/data/org/employee_phones?employee_id=${employeeId}&limit=1`).catch(() => ({ data: [] as EmployeePhone[] })),
          request<EmployeeAddress[]>(`/data/org/employee_addresses?employee_id=${employeeId}&limit=1`).catch(() => ({ data: [] as EmployeeAddress[] })),
          request<EmergencyContact[]>(`/data/org/emergency_contacts?employee_id=${employeeId}&limit=1`).catch(() => ({ data: [] as EmergencyContact[] }))
        ]);

        if (!active) return;
        const emp = empRes.data;
        const p = phoneRes.data?.[0] || null;
        const a = addrRes.data?.[0] || null;
        const em = emgRes.data?.[0] || null;

        setEmployee(emp);
        setPhone(p);
        setAddress(a);
        setEmergency(em);

        setForm({
          f_name: emp.f_name || '',
          l_name: emp.l_name || '',
          email: emp.email || '',
          dept_id: emp.dept_id ? String(emp.dept_id) : '',
          job_id: emp.job_id ? String(emp.job_id) : '',
          office_id: emp.office_id ? String(emp.office_id) : '',
          manager_id: emp.manager_id ? String(emp.manager_id) : '',
          employment_status: emp.employment_status || 'Active',
          hire_date: emp.hire_date ? emp.hire_date.slice(0, 10) : '',
          gender: emp.gender || '',
          birth_date: emp.birth_date ? emp.birth_date.slice(0, 10) : '',
          national_id: emp.national_id || '',
          nationality: emp.nationality || '',
          phone_number: p?.phone_number || '',
          address_line: a?.address_line || '',
          city: a?.city || '',
          emergency_name: em?.name || '',
          emergency_phone: em?.phone || ''
        });
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load employee details');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();
    return () => { active = false; };
  }, [employeeId]);

  if (!employeeId) return null;

  const deptMap = new Map(departments.map((d) => [d.dept_id, d.dept_name]));
  const jobMap = new Map(jobs.map((j) => [j.job_id, j.title_name]));
  const officeMap = new Map(offices.map((o) => [o.office_id, `${o.location_name}${o.city ? ` (${o.city})` : ''}`]));
  const managerMap = new Map(allEmployees.map((e) => [e.employee_id, `${e.f_name} ${e.l_name}`]));

  const initials = employee ? `${employee.f_name?.[0] ?? ''}${employee.l_name?.[0] ?? ''}`.toUpperCase() : 'EM';

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!employeeId) return;

    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      // 1. Update core employee record
      if (canEditWork) {
        const updatePayload: Record<string, unknown> = {
          f_name: form.f_name.trim(),
          l_name: form.l_name.trim(),
          email: form.email.trim(),
          dept_id: form.dept_id ? Number(form.dept_id) : null,
          job_id: form.job_id ? Number(form.job_id) : null,
          office_id: form.office_id ? Number(form.office_id) : null,
          manager_id: form.manager_id ? Number(form.manager_id) : null,
          employment_status: form.employment_status,
          hire_date: form.hire_date || null,
          gender: form.gender || null,
          birth_date: form.birth_date || null,
          national_id: form.national_id.trim() || null,
          nationality: form.nationality.trim() || null
        };

        await request(`/data/org/employee/${employeeId}`, {
          method: 'PATCH',
          body: JSON.stringify(updatePayload)
        });
      }

      // 2. Update/create phone
      if (canEditContact && form.phone_number.trim()) {
        if (phone?.phone_id) {
          await request(`/data/org/employee_phones/${phone.phone_id}`, {
            method: 'PATCH',
            body: JSON.stringify({ phone_number: form.phone_number.trim() })
          }).catch(() => undefined);
        } else {
          await request('/data/org/employee_phones', {
            method: 'POST',
            body: JSON.stringify({
              employee_id: employeeId,
              phone_type: 'Mobile',
              phone_number: form.phone_number.trim(),
              is_primary: true
            })
          }).catch(() => undefined);
        }
      }

      // 3. Update/create address
      if (canEditContact && form.address_line.trim()) {
        if (address?.address_id) {
          await request(`/data/org/employee_addresses/${address.address_id}`, {
            method: 'PATCH',
            body: JSON.stringify({ address_line: form.address_line.trim(), city: form.city.trim() || null })
          }).catch(() => undefined);
        } else {
          await request('/data/org/employee_addresses', {
            method: 'POST',
            body: JSON.stringify({
              employee_id: employeeId,
              address_type: 'Home',
              address_line: form.address_line.trim(),
              city: form.city.trim() || null,
              is_primary: true
            })
          }).catch(() => undefined);
        }
      }

      // 4. Update/create emergency contact
      if (canEditContact && (form.emergency_name.trim() || form.emergency_phone.trim())) {
        if (emergency?.contact_id) {
          await request(`/data/org/emergency_contacts/${emergency.contact_id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name: form.emergency_name.trim(),
              phone: form.emergency_phone.trim()
            })
          }).catch(() => undefined);
        } else {
          await request('/data/org/emergency_contacts', {
            method: 'POST',
            body: JSON.stringify({
              employee_id: employeeId,
              name: form.emergency_name.trim(),
              phone: form.emergency_phone.trim()
            })
          }).catch(() => undefined);
        }
      }

      setSuccessMsg('Profile updated successfully!');
      setIsEditing(false);
      onUpdated();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save profile changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" aria-label="Employee Profile Details">
        <div className="drawer-header">
          <div className="drawer-header-left">
            <span className="avatar avatar-lg">{initials}</span>
            <div>
              <h2>{employee?.f_name} {employee?.l_name}</h2>
              <small>{employee?.email}</small>
            </div>
          </div>
          <button type="button" className="button-link drawer-close" onClick={onClose} aria-label="Close drawer">✕</button>
        </div>

        {error && <p className="form-error" style={{ margin: '1rem' }} role="alert">{error}</p>}
        {successMsg && <p className="form-success" style={{ margin: '1rem' }} role="status">{successMsg}</p>}

        <div className="drawer-body">
          {loading ? (
            <p className="loading-cell">Loading employee details…</p>
          ) : !employee ? (
            <p className="loading-cell">Employee not found.</p>
          ) : (
            <form onSubmit={handleSave}>
              <div className="drawer-top-actions">
                <span className={`status status-${employee.employment_status.toLowerCase().replaceAll(' ', '-')}`}>
                  {employee.employment_status}
                </span>
                {(canEditWork || canEditContact) && !isEditing && (
                  <button type="button" className="button primary btn-sm" onClick={() => setIsEditing(true)}>
                    ✎ Edit Profile
                  </button>
                )}
                {isEditing && (
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    <button type="button" className="button btn-sm" onClick={() => setIsEditing(false)} disabled={saving}>
                      Cancel
                    </button>
                    <button type="submit" className="button primary btn-sm" disabled={saving}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>

              {/* 1. Work & Organization */}
              <div className="drawer-section">
                <h3>Work & Organization</h3>
                <div className="info-grid">
                  <div className="info-field">
                    <span className="info-label">Department</span>
                    {isEditing && canEditWork ? (
                      <select value={form.dept_id} onChange={(e) => setForm({ ...form, dept_id: e.target.value })}>
                        <option value="">None</option>
                        {departments.map((d) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
                      </select>
                    ) : (
                      <span className="info-val">{deptMap.get(employee.dept_id ?? -1) || '—'}</span>
                    )}
                  </div>

                  <div className="info-field">
                    <span className="info-label">Job Title</span>
                    {isEditing && canEditWork ? (
                      <select value={form.job_id} onChange={(e) => setForm({ ...form, job_id: e.target.value })}>
                        <option value="">None</option>
                        {jobs.map((j) => <option key={j.job_id} value={j.job_id}>{j.title_name}</option>)}
                      </select>
                    ) : (
                      <span className="info-val">{jobMap.get(employee.job_id ?? -1) || '—'}</span>
                    )}
                  </div>

                  <div className="info-field">
                    <span className="info-label">Office Location</span>
                    {isEditing && canEditWork ? (
                      <select value={form.office_id} onChange={(e) => setForm({ ...form, office_id: e.target.value })}>
                        <option value="">None</option>
                        {offices.map((o) => <option key={o.office_id} value={o.office_id}>{o.location_name} {o.city ? `(${o.city})` : ''}</option>)}
                      </select>
                    ) : (
                      <span className="info-val">{officeMap.get(employee.office_id ?? -1) || '—'}</span>
                    )}
                  </div>

                  <div className="info-field">
                    <span className="info-label">Manager</span>
                    {isEditing && canEditWork ? (
                      <select value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                        <option value="">None</option>
                        {allEmployees.filter((e) => e.employee_id !== employeeId).map((e) => (
                          <option key={e.employee_id} value={e.employee_id}>{e.f_name} {e.l_name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="info-val">{managerMap.get(employee.manager_id ?? -1) || '—'}</span>
                    )}
                  </div>

                  <div className="info-field">
                    <span className="info-label">Hire Date</span>
                    {isEditing && canEditWork ? (
                      <input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
                    ) : (
                      <span className="info-val">{employee.hire_date ? employee.hire_date.slice(0, 10) : '—'}</span>
                    )}
                  </div>

                  {isEditing && canEditWork && (
                    <div className="info-field">
                      <span className="info-label">Employment Status</span>
                      <select value={form.employment_status} onChange={(e) => setForm({ ...form, employment_status: e.target.value })}>
                        <option value="Active">Active</option>
                        <option value="On Leave">On Leave</option>
                        <option value="Terminated">Terminated</option>
                        <option value="Probation">Probation</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Personal & Identity */}
              <div className="drawer-section">
                <h3>Personal & Identity</h3>
                <div className="info-grid">
                  <div className="info-field">
                    <span className="info-label">National ID</span>
                    {isEditing && canEditWork ? (
                      <input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} placeholder="National ID" />
                    ) : (
                      <span className="info-val">{employee.national_id || '—'}</span>
                    )}
                  </div>

                  <div className="info-field">
                    <span className="info-label">Nationality</span>
                    {isEditing && canEditWork ? (
                      <input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="Nationality" />
                    ) : (
                      <span className="info-val">{employee.nationality || '—'}</span>
                    )}
                  </div>

                  <div className="info-field">
                    <span className="info-label">Gender</span>
                    {isEditing && canEditWork ? (
                      <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <span className="info-val">{employee.gender || '—'}</span>
                    )}
                  </div>

                  <div className="info-field">
                    <span className="info-label">Birth Date</span>
                    {isEditing && canEditWork ? (
                      <input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
                    ) : (
                      <span className="info-val">{employee.birth_date ? employee.birth_date.slice(0, 10) : '—'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Contact Details */}
              <div className="drawer-section">
                <h3>Contact & Emergency</h3>
                <div className="info-grid">
                  <div className="info-field wide">
                    <span className="info-label">Phone Number</span>
                    {isEditing && canEditContact ? (
                      <input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="+251..." />
                    ) : (
                      <span className="info-val">{phone?.phone_number || '—'}</span>
                    )}
                  </div>

                  <div className="info-field wide">
                    <span className="info-label">Residential Address</span>
                    {isEditing && canEditContact ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '.5rem' }}>
                        <input value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} placeholder="Street / Address line" />
                        <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />
                      </div>
                    ) : (
                      <span className="info-val">
                        {address?.address_line ? `${address.address_line}${address.city ? `, ${address.city}` : ''}` : '—'}
                      </span>
                    )}
                  </div>

                  <div className="info-field">
                    <span className="info-label">Emergency Contact Name</span>
                    {isEditing && canEditContact ? (
                      <input value={form.emergency_name} onChange={(e) => setForm({ ...form, emergency_name: e.target.value })} placeholder="Contact Person" />
                    ) : (
                      <span className="info-val">{emergency?.name || '—'}</span>
                    )}
                  </div>

                  <div className="info-field">
                    <span className="info-label">Emergency Contact Phone</span>
                    {isEditing && canEditContact ? (
                      <input value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} placeholder="Phone Number" />
                    ) : (
                      <span className="info-val">{emergency?.phone || '—'}</span>
                    )}
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </aside>
    </>
  );
}

