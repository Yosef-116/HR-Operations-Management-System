import { useCallback, useEffect, useMemo, useState } from 'react';
import { request } from '../../api';
import { useAuth } from '../../auth';
import type { Asset, AssetAssignment, Department, Employee } from '../../types';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

function getAssetIcon(type: string): string {
  const lower = (type || '').toLowerCase();
  if (lower.includes('laptop') || lower.includes('macbook')) return '💻';
  if (lower.includes('monitor') || lower.includes('display') || lower.includes('tv')) return '🖥';
  if (lower.includes('phone') || lower.includes('mobile')) return '📱';
  if (lower.includes('vehicle') || lower.includes('car') || lower.includes('truck')) return '🚗';
  if (lower.includes('card') || lower.includes('badge') || lower.includes('key')) return '🔑';
  if (lower.includes('desktop') || lower.includes('workstation')) return '🖥️';
  return '📦';
}

export function AssetsPage() {
  const { user } = useAuth();

  const canManageAssets = useMemo(() => {
    if (!user) return false;
    if (user.roles?.includes('Admin') || user.permissions?.includes('manage_all')) return true;
    return user.permissions?.some((p) => ['manage_org', 'manage_all'].includes(p));
  }, [user]);

  const [activeTab, setActiveTab] = useState<'inventory' | 'my-assets' | 'history'>(
    canManageAssets ? 'inventory' : 'my-assets'
  );

  const [assets, setAssets] = useState<Asset[]>([]);
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [employees, setEmployees] = useState<Map<number, Employee>>(new Map());
  const [departments, setDepartments] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [assetToAssign, setAssetToAssign] = useState<Asset | null>(null);
  const [assignmentToReturn, setAssignmentToReturn] = useState<{ assignment: AssetAssignment; asset: Asset } | null>(null);

  // Form states
  const [newAsset, setNewAsset] = useState({
    asset_name: '',
    asset_type: 'Laptop',
    serial_number: '',
    purchase_date: new Date().toISOString().slice(0, 10),
    condition: 'New',
    status: 'Available' as const
  });

  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    assigned_date: new Date().toISOString().slice(0, 10)
  });

  const [returnForm, setReturnForm] = useState({
    returned_date: new Date().toISOString().slice(0, 10),
    condition_on_return: 'Good',
    asset_status: 'Available' as 'Available' | 'Maintenance' | 'Retired'
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Available' | 'Assigned' | 'Maintenance' | 'Retired'>('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (canManageAssets) {
        const [assetsRes, assignmentsRes, empsRes, deptsRes] = await Promise.all([
          request<Asset[]>('/data/org/assets?limit=500').catch(() => ({ data: [] as Asset[] })),
          request<AssetAssignment[]>('/data/org/asset_assignments?limit=1000').catch(() => ({ data: [] as AssetAssignment[] })),
          request<Employee[]>('/data/org/employee?limit=250').catch(() => ({ data: [] as Employee[] })),
          request<Department[]>('/data/org/departments?limit=50').catch(() => ({ data: [] as Department[] }))
        ]);

        setAssets(assetsRes.data || []);
        setAssignments((assignmentsRes.data || []).sort((a, b) => new Date(b.assigned_date).getTime() - new Date(a.assigned_date).getTime()));

        const empMap = new Map<number, Employee>();
        for (const e of empsRes.data || []) empMap.set(e.employee_id, e);
        setEmployees(empMap);

        const deptMap = new Map<number, string>();
        for (const d of deptsRes.data || []) deptMap.set(d.dept_id, d.dept_name);
        setDepartments(deptMap);
      } else {
        // Employee self service: loads their assignments and asset lookup
        const [assignmentsRes, assetsRes] = await Promise.all([
          request<AssetAssignment[]>('/data/org/asset_assignments?limit=50').catch(() => ({ data: [] as AssetAssignment[] })),
          request<Asset[]>('/data/org/assets?limit=200').catch(() => ({ data: [] as Asset[] }))
        ]);

        setAssignments(assignmentsRes.data || []);
        setAssets(assetsRes.data || []);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load asset records');
    } finally {
      setLoading(false);
    }
  }, [canManageAssets]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Map each asset_id to its active assignment (returned_date IS NULL)
  const activeAssignmentMap = useMemo(() => {
    const map = new Map<number, AssetAssignment>();
    for (const a of assignments) {
      if (!a.returned_date && !map.has(a.asset_id)) {
        map.set(a.asset_id, a);
      }
    }
    return map;
  }, [assignments]);

  // Asset lookup map
  const assetMap = useMemo(() => {
    const map = new Map<number, Asset>();
    for (const a of assets) map.set(a.asset_id, a);
    return map;
  }, [assets]);

  // My personal active assets
  const myActiveAssignments = useMemo(() => {
    if (!user?.employee_id) return [];
    return assignments.filter((a) => a.employee_id === user.employee_id && !a.returned_date);
  }, [assignments, user?.employee_id]);

  // Filtered assets list for inventory table
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (asset.is_deleted) return false;
      if (statusFilter !== 'all' && asset.status !== statusFilter) return false;
      if (typeFilter !== 'all' && asset.asset_type.toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = asset.asset_name.toLowerCase().includes(query);
        const matchesSerial = (asset.serial_number || '').toLowerCase().includes(query);
        const matchesType = asset.asset_type.toLowerCase().includes(query);
        const activeAsg = activeAssignmentMap.get(asset.asset_id);
        const empName = activeAsg ? `${employees.get(activeAsg.employee_id)?.f_name || ''} ${employees.get(activeAsg.employee_id)?.l_name || ''}`.toLowerCase() : '';
        return matchesName || matchesSerial || matchesType || empName.includes(query);
      }
      return true;
    });
  }, [assets, statusFilter, typeFilter, searchQuery, activeAssignmentMap, employees]);

  // Asset types list for filters
  const assetTypes = useMemo(() => {
    const set = new Set<string>();
    for (const a of assets) {
      if (a.asset_type) set.add(a.asset_type);
    }
    return Array.from(set);
  }, [assets]);

  // Register Asset Submit
  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.asset_name.trim()) return;
    setActionLoading('register');
    setError('');
    setSuccess('');
    try {
      await request('/data/org/assets', {
        method: 'POST',
        body: JSON.stringify(newAsset)
      });
      setSuccess(`Asset "${newAsset.asset_name}" registered successfully.`);
      setShowRegisterModal(false);
      setNewAsset({
        asset_name: '',
        asset_type: 'Laptop',
        serial_number: '',
        purchase_date: new Date().toISOString().slice(0, 10),
        condition: 'New',
        status: 'Available'
      });
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not register asset');
    } finally {
      setActionLoading(null);
    }
  };

  // Assign Asset Submit
  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetToAssign || !assignForm.employee_id) return;
    setActionLoading('assign');
    setError('');
    setSuccess('');
    try {
      await request(`/workflows/assets/${assetToAssign.asset_id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(assignForm.employee_id),
          assigned_date: assignForm.assigned_date
        })
      });
      const emp = employees.get(Number(assignForm.employee_id));
      const empName = emp ? `${emp.f_name} ${emp.l_name}`.trim() : `Employee #${assignForm.employee_id}`;
      setSuccess(`Assigned "${assetToAssign.asset_name}" to ${empName}.`);
      setAssetToAssign(null);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not assign asset');
    } finally {
      setActionLoading(null);
    }
  };

  // Return Asset Submit
  const handleReturnAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentToReturn) return;
    setActionLoading('return');
    setError('');
    setSuccess('');
    try {
      await request(`/workflows/asset-assignments/${assignmentToReturn.assignment.assignment_id}/return`, {
        method: 'POST',
        body: JSON.stringify(returnForm)
      });
      setSuccess(`Marked "${assignmentToReturn.asset.asset_name}" as returned (${returnForm.asset_status}).`);
      setAssignmentToReturn(null);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not process asset return');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="assets-module" style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Top Header Card */}
      <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="eyebrow">Operations & Equipment</span>
            <h1 style={{ margin: '.2rem 0 .4rem', fontSize: '1.65rem' }}>
              {canManageAssets ? 'Asset Inventory & Hardware Management' : 'My Assigned Equipment'}
            </h1>
            <p style={{ margin: 0, color: '#90909a', fontSize: '.9rem' }}>
              {canManageAssets
                ? 'Track company hardware, laptops, vehicles, and devices. Manage employee assignments, condition checks, and returns.'
                : 'Review the company laptops, devices, and accessories currently checked out in your custody.'}
            </p>
          </div>
          {canManageAssets && (
            <button
              className="button-primary"
              onClick={() => setShowRegisterModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}
            >
              <span>+</span> Register New Asset
            </button>
          )}
        </div>

        {/* Tab Controls for Managers */}
        {canManageAssets && (
          <div className="subnav-tabs" style={{ display: 'flex', gap: '.5rem', marginTop: '1.25rem', borderTop: '1px solid #2d2d35', paddingTop: '1rem' }}>
            <button
              className={`subnav-tab ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              Asset Inventory ({assets.filter((a) => !a.is_deleted).length})
            </button>
            <button
              className={`subnav-tab ${activeTab === 'my-assets' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-assets')}
            >
              My Custody ({myActiveAssignments.length})
            </button>
            <button
              className={`subnav-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Assignment History ({assignments.length})
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
      {/* TAB 1: ASSET INVENTORY & WORKFLOW (Admin / Ops)                */}
      {/* ============================================================== */}
      {canManageAssets && activeTab === 'inventory' && (
        <>
          {/* KPI Metrics */}
          <div className="stats-grid" style={{ margin: 0 }}>
            <article className="stat-card">
              <span>Total Fleet Assets</span>
              <strong>{assets.filter((a) => !a.is_deleted).length}</strong>
              <small>Registered hardware in system</small>
            </article>
            <article className="stat-card">
              <span>Currently Assigned</span>
              <strong style={{ color: '#8c7cf5' }}>
                {assets.filter((a) => a.status === 'Assigned' && !a.is_deleted).length}
              </strong>
              <small>In employee possession</small>
            </article>
            <article className="stat-card">
              <span>Available in Stock</span>
              <strong style={{ color: '#52d9a6' }}>
                {assets.filter((a) => a.status === 'Available' && !a.is_deleted).length}
              </strong>
              <small>Ready for deployment</small>
            </article>
            <article className="stat-card">
              <span>Maintenance / Repair</span>
              <strong style={{ color: '#ffd27a' }}>
                {assets.filter((a) => a.status === 'Maintenance' && !a.is_deleted).length}
              </strong>
              <small>Undergoing repair or inspection</small>
            </article>
          </div>

          {/* Table Card */}
          <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
            {/* Filter Toolbar */}
            <div className="toolbar" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search asset, serial #, or assignee…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ minWidth: '240px' }}
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'Available' | 'Assigned' | 'Maintenance' | 'Retired')}
                  style={{ padding: '.55rem .8rem', borderRadius: '.5rem', border: '1px solid #3b3b43', background: '#202025', color: '#f0f0f2' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="Available">Available (In Stock)</option>
                  <option value="Assigned">Assigned</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Retired">Retired</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{ padding: '.55rem .8rem', borderRadius: '.5rem', border: '1px solid #3b3b43', background: '#202025', color: '#f0f0f2' }}
                >
                  <option value="all">All Equipment Types</option>
                  {assetTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <button className="button-secondary" onClick={() => void loadData()} disabled={loading}>
                {loading ? 'Refreshing…' : '↻ Refresh'}
              </button>
            </div>

            {loading && assets.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2.5rem', color: '#90909a' }}>Loading asset inventory…</p>
            ) : filteredAssets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#90909a' }}>
                <p style={{ fontSize: '1.1rem', margin: '0 0 .5rem', color: '#f0f0f2' }}>No assets match your search</p>
                <small>Click &quot;+ Register New Asset&quot; to add company hardware to the fleet.</small>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Asset ID</th>
                      <th>Equipment & Type</th>
                      <th>Serial Number</th>
                      <th>Condition</th>
                      <th>Status</th>
                      <th>Current Assignee</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map((asset) => {
                      const activeAsg = activeAssignmentMap.get(asset.asset_id);
                      const emp = activeAsg ? employees.get(activeAsg.employee_id) : null;
                      const empName = emp ? `${emp.f_name} ${emp.l_name}`.trim() : activeAsg ? `Employee #${activeAsg.employee_id}` : null;
                      const deptName = emp?.dept_id ? departments.get(emp.dept_id) || null : null;

                      return (
                        <tr key={asset.asset_id}>
                          <td><strong>#{String(asset.asset_id).padStart(3, '0')}</strong></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem' }}>
                              <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{getAssetIcon(asset.asset_type)}</span>
                              <div>
                                <strong style={{ color: '#f0f0f2' }}>{asset.asset_name}</strong>
                                <small style={{ color: '#90909a' }}>{asset.asset_type}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <code style={{ background: '#24242c', padding: '.2rem .4rem', borderRadius: '.3rem', fontSize: '.8rem' }}>
                              {asset.serial_number || '—'}
                            </code>
                          </td>
                          <td>
                            <span style={{ fontSize: '.82rem', color: asset.condition === 'Damaged' ? '#ff9494' : '#c9c9d2' }}>
                              {asset.condition || 'Good'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${
                              asset.status === 'Available'
                                ? 'badge-approved'
                                : asset.status === 'Assigned'
                                ? 'badge-pending'
                                : 'badge-draft'
                            }`}>
                              {asset.status}
                            </span>
                          </td>
                          <td>
                            {empName ? (
                              <div>
                                <strong>{empName}</strong>
                                <small style={{ color: '#90909a' }}>
                                  {deptName ? `${deptName} • ` : ''}Since {formatDate(activeAsg?.assigned_date)}
                                </small>
                              </div>
                            ) : (
                              <span style={{ color: '#686873', fontSize: '.82rem' }}>— In Inventory —</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {asset.status === 'Available' && (
                              <button
                                className="button-primary"
                                onClick={() => {
                                  setAssetToAssign(asset);
                                  setAssignForm({
                                    employee_id: '',
                                    assigned_date: new Date().toISOString().slice(0, 10)
                                  });
                                }}
                                style={{ fontSize: '.78rem', padding: '.35rem .75rem' }}
                              >
                                👤 Assign
                              </button>
                            )}

                            {asset.status === 'Assigned' && activeAsg && (
                              <button
                                className="button-secondary"
                                onClick={() => {
                                  setAssignmentToReturn({ assignment: activeAsg, asset });
                                  setReturnForm({
                                    returned_date: new Date().toISOString().slice(0, 10),
                                    condition_on_return: asset.condition || 'Good',
                                    asset_status: 'Available'
                                  });
                                }}
                                style={{ fontSize: '.78rem', padding: '.35rem .75rem', borderColor: '#ffd27a', color: '#ffd27a' }}
                              >
                                ↩ Return
                              </button>
                            )}

                            {asset.status === 'Maintenance' && (
                              <button
                                className="button-secondary"
                                onClick={async () => {
                                  try {
                                    await request(`/data/org/assets/${asset.asset_id}`, {
                                      method: 'PUT',
                                      body: JSON.stringify({ status: 'Available', condition: 'Good' })
                                    });
                                    setSuccess(`Asset #${asset.asset_id} repaired and returned to available stock.`);
                                    await loadData();
                                  } catch (cause) {
                                    setError(cause instanceof Error ? cause.message : 'Could not update asset');
                                  }
                                }}
                                style={{ fontSize: '.78rem', padding: '.35rem .75rem', color: '#52d9a6', borderColor: '#52d9a6' }}
                              >
                                ✓ Mark Repaired
                              </button>
                            )}
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
      {/* TAB 2: MY ASSIGNED EQUIPMENT (Self Service)                    */}
      {/* ============================================================== */}
      {(!canManageAssets || activeTab === 'my-assets') && (
        <>
          <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: '0 0 .2rem', fontSize: '1.15rem' }}>Hardware Checked Out To Me</h3>
                <small style={{ color: '#90909a' }}>
                  {myActiveAssignments.length} {myActiveAssignments.length === 1 ? 'item' : 'items'} currently assigned to your profile
                </small>
              </div>
            </div>

            {loading && myActiveAssignments.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#90909a' }}>Loading your equipment…</p>
            ) : myActiveAssignments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#90909a' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '.75rem' }}>💻</span>
                <p style={{ fontSize: '1.1rem', margin: '0 0 .5rem', color: '#f0f0f2' }}>No hardware currently checked out</p>
                <small>If you require a laptop, display, or accessories, please contact the IT / Operations department.</small>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                {myActiveAssignments.map((asg) => {
                  const asset = assetMap.get(asg.asset_id);
                  if (!asset) return null;

                  return (
                    <article
                      key={asg.assignment_id}
                      className="card"
                      style={{ background: '#202026', border: '1px solid #32323e', padding: '1.25rem', display: 'grid', gap: '.9rem' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{getAssetIcon(asset.asset_type)}</span>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#f0f0f2' }}>{asset.asset_name}</h4>
                            <small style={{ color: '#90909a' }}>{asset.asset_type}</small>
                          </div>
                        </div>
                        <span className="badge badge-approved" style={{ fontSize: '.72rem' }}>In Custody</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem', background: '#19191e', padding: '.75rem', borderRadius: '.5rem', fontSize: '.82rem' }}>
                        <div>
                          <span style={{ color: '#8a8a96', display: 'block' }}>Serial Number</span>
                          <strong style={{ color: '#e0e0e8' }}>{asset.serial_number || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#8a8a96', display: 'block' }}>Condition</span>
                          <strong style={{ color: '#e0e0e8' }}>{asset.condition || 'Good'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#8a8a96', display: 'block' }}>Date Assigned</span>
                          <strong style={{ color: '#e0e0e8' }}>{formatDate(asg.assigned_date)}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#8a8a96', display: 'block' }}>Assignment ID</span>
                          <strong style={{ color: '#e0e0e8' }}>#{asg.assignment_id}</strong>
                        </div>
                      </div>

                      <p style={{ margin: 0, fontSize: '.78rem', color: '#8a8a96' }}>
                        🛡️ Please maintain equipment in clean condition and report any technical faults immediately.
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* ============================================================== */}
      {/* TAB 3: ASSIGNMENT HISTORY & AUDIT LOG (Admin / Ops)            */}
      {/* ============================================================== */}
      {canManageAssets && activeTab === 'history' && (
        <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Equipment Assignment Log & Audit History</h3>
            <small style={{ color: '#90909a' }}>{assignments.length} total assignment transactions recorded</small>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Assignment #</th>
                  <th>Asset</th>
                  <th>Assigned Employee</th>
                  <th>Date Assigned</th>
                  <th>Date Returned</th>
                  <th>Condition on Return</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#90909a' }}>No assignment history found</td></tr>
                ) : (
                  assignments.map((asg) => {
                    const asset = assetMap.get(asg.asset_id);
                    const emp = employees.get(asg.employee_id);
                    const empName = emp ? `${emp.f_name} ${emp.l_name}`.trim() : `Employee #${asg.employee_id}`;
                    const isReturned = Boolean(asg.returned_date);

                    return (
                      <tr key={asg.assignment_id}>
                        <td><strong>#{asg.assignment_id}</strong></td>
                        <td>
                          <strong>{asset?.asset_name || `Asset #${asg.asset_id}`}</strong>
                          <small style={{ color: '#90909a' }}>{asset?.serial_number || 'No serial'}</small>
                        </td>
                        <td>
                          <strong>{empName}</strong>
                          <small style={{ color: '#90909a' }}>ID #{asg.employee_id}</small>
                        </td>
                        <td>{formatDate(asg.assigned_date)}</td>
                        <td>{formatDate(asg.returned_date)}</td>
                        <td>{asg.condition_on_return || '—'}</td>
                        <td>
                          <span className={`badge ${isReturned ? 'badge-draft' : 'badge-approved'}`}>
                            {isReturned ? 'Returned' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* MODAL: REGISTER NEW ASSET                                      */}
      {/* ============================================================== */}
      {showRegisterModal && (
        <div className="modal-backdrop" onClick={() => setShowRegisterModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <h2>Register New Hardware Asset</h2>
              <button className="button-link" onClick={() => setShowRegisterModal(false)}>✕</button>
            </div>
            <form onSubmit={handleRegisterAsset}>
              <div className="form-grid">
                <div className="wide">
                  <label htmlFor="reg-name">Asset / Device Name *</label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    placeholder="e.g. MacBook Pro 16 M3 Max, Dell UltraSharp 27"
                    value={newAsset.asset_name}
                    onChange={(e) => setNewAsset({ ...newAsset, asset_name: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="reg-type">Equipment Category *</label>
                  <select
                    id="reg-type"
                    value={newAsset.asset_type}
                    onChange={(e) => setNewAsset({ ...newAsset, asset_type: e.target.value })}
                  >
                    <option value="Laptop">Laptop</option>
                    <option value="Desktop">Desktop / Workstation</option>
                    <option value="Monitor">Monitor / Display</option>
                    <option value="Phone">Mobile Phone</option>
                    <option value="Vehicle">Vehicle</option>
                    <option value="Peripheral">Peripheral / Accessory</option>
                    <option value="Keycard">Access Card / Key</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-serial">Serial Number *</label>
                  <input
                    id="reg-serial"
                    type="text"
                    required
                    placeholder="e.g. SN-8921-X4"
                    value={newAsset.serial_number}
                    onChange={(e) => setNewAsset({ ...newAsset, serial_number: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="reg-date">Purchase Date</label>
                  <input
                    id="reg-date"
                    type="date"
                    value={newAsset.purchase_date}
                    onChange={(e) => setNewAsset({ ...newAsset, purchase_date: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="reg-condition">Condition</label>
                  <select
                    id="reg-condition"
                    value={newAsset.condition}
                    onChange={(e) => setNewAsset({ ...newAsset, condition: e.target.value })}
                  >
                    <option value="New">New</option>
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="button-secondary" onClick={() => setShowRegisterModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="button-primary" disabled={actionLoading === 'register'}>
                  {actionLoading === 'register' ? 'Registering…' : 'Save to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ASSIGN ASSET TO EMPLOYEE                                */}
      {/* ============================================================== */}
      {assetToAssign && (
        <div className="modal-backdrop" onClick={() => setAssetToAssign(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <h2>Assign Equipment to Employee</h2>
              <button className="button-link" onClick={() => setAssetToAssign(null)}>✕</button>
            </div>
            <div style={{ background: '#202027', padding: '.85rem 1.1rem', borderRadius: '.6rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{getAssetIcon(assetToAssign.asset_type)}</span>
                <div>
                  <strong>{assetToAssign.asset_name}</strong>
                  <small style={{ display: 'block', color: '#90909a' }}>
                    Serial: {assetToAssign.serial_number || 'N/A'} • Condition: {assetToAssign.condition || 'Good'}
                  </small>
                </div>
              </div>
            </div>

            <form onSubmit={handleAssignAsset}>
              <div className="form-grid">
                <div className="wide">
                  <label htmlFor="assign-emp">Select Recipient Employee *</label>
                  <select
                    id="assign-emp"
                    required
                    value={assignForm.employee_id}
                    onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
                  >
                    <option value="">-- Choose employee --</option>
                    {Array.from(employees.values())
                      .filter((e) => e.employment_status === 'Active')
                      .sort((a, b) => a.f_name.localeCompare(b.f_name))
                      .map((emp) => (
                        <option key={emp.employee_id} value={emp.employee_id}>
                          {emp.f_name} {emp.l_name} ({departments.get(emp.dept_id || 0) || 'General'}) — #{emp.employee_id}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="wide">
                  <label htmlFor="assign-date">Date Handed Over *</label>
                  <input
                    id="assign-date"
                    type="date"
                    required
                    value={assignForm.assigned_date}
                    onChange={(e) => setAssignForm({ ...assignForm, assigned_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="button-secondary" onClick={() => setAssetToAssign(null)}>
                  Cancel
                </button>
                <button type="submit" className="button-primary" disabled={actionLoading === 'assign' || !assignForm.employee_id}>
                  {actionLoading === 'assign' ? 'Assigning…' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: RETURN ASSET FROM EMPLOYEE                              */}
      {/* ============================================================== */}
      {assignmentToReturn && (() => {
        const { assignment, asset } = assignmentToReturn;
        const emp = employees.get(assignment.employee_id);
        const empName = emp ? `${emp.f_name} ${emp.l_name}`.trim() : `Employee #${assignment.employee_id}`;

        return (
          <div className="modal-backdrop" onClick={() => setAssignmentToReturn(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-heading">
                <h2>Process Equipment Return</h2>
                <button className="button-link" onClick={() => setAssignmentToReturn(null)}>✕</button>
              </div>
              <div style={{ background: '#202027', padding: '.85rem 1.1rem', borderRadius: '.6rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{getAssetIcon(asset.asset_type)}</span>
                  <div>
                    <strong>{asset.asset_name}</strong>
                    <small style={{ display: 'block', color: '#90909a' }}>
                      Returning from: <strong>{empName}</strong> • Serial: {asset.serial_number || 'N/A'}
                    </small>
                  </div>
                </div>
              </div>

              <form onSubmit={handleReturnAsset}>
                <div className="form-grid">
                  <div>
                    <label htmlFor="return-date">Date Returned *</label>
                    <input
                      id="return-date"
                      type="date"
                      required
                      value={returnForm.returned_date}
                      onChange={(e) => setReturnForm({ ...returnForm, returned_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="return-condition">Condition on Return *</label>
                    <select
                      id="return-condition"
                      value={returnForm.condition_on_return}
                      onChange={(e) => setReturnForm({ ...returnForm, condition_on_return: e.target.value })}
                    >
                      <option value="New">New / Unused</option>
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good / Normal Wear</option>
                      <option value="Fair">Fair / Minor Scratches</option>
                      <option value="Damaged">Damaged / Needs Repair</option>
                    </select>
                  </div>
                  <div className="wide">
                    <label htmlFor="return-status">Post-Return Status *</label>
                    <select
                      id="return-status"
                      value={returnForm.asset_status}
                      onChange={(e) => setReturnForm({ ...returnForm, asset_status: e.target.value as 'Available' | 'Maintenance' | 'Retired' })}
                    >
                      <option value="Available">Available (Return to Inventory Shelf)</option>
                      <option value="Maintenance">Maintenance (Send to IT for Service)</option>
                      <option value="Retired">Retired / Write-Off</option>
                    </select>
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="button-secondary" onClick={() => setAssignmentToReturn(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="button-primary" disabled={actionLoading === 'return'}>
                    {actionLoading === 'return' ? 'Processing…' : 'Complete Return'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
