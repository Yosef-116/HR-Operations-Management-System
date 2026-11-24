import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { request } from '../../api';
import { useAuth } from '../../auth';
import type {
  Candidate,
  CandidatePhone,
  Department,
  Employee,
  JobTitle,
  Office,
  RecruitmentResult,
  Vacancy
} from '../../types';

const VACANCY_TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Temporary'] as const;
const CANDIDATE_STAGES = ['Pending', 'Shortlisted', 'Interviewing', 'Offered', 'Hired', 'Rejected'] as const;
const CANDIDATE_SOURCES = ['Career Portal', 'LinkedIn', 'Employee Referral', 'Agency', 'University', 'Direct Application'] as const;

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

function getStageBadgeClass(status: string): string {
  switch (status) {
    case 'Hired':
    case 'Open':
      return 'badge badge-approved';
    case 'Offered':
    case 'Interviewing':
    case 'Shortlisted':
      return 'badge badge-review';
    case 'Rejected':
    case 'Closed':
      return 'badge badge-open';
    case 'Filled':
      return 'badge badge-draft';
    default:
      return 'badge badge-pending';
  }
}

export function RecruitmentPage() {
  const { user } = useAuth();

  const canManage = useMemo(() => {
    if (!user) return false;
    if (user.roles?.includes('Admin') || user.permissions?.includes('manage_all')) return true;
    return Boolean(user.permissions?.includes('manage_recruitment'));
  }, [user]);

  const canView = useMemo(() => {
    if (canManage) return true;
    return Boolean(user?.permissions?.includes('view_recruitment'));
  }, [user, canManage]);

  const [activeTab, setActiveTab] = useState<'vacancies' | 'candidates' | 'titles'>('vacancies');

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [results, setResults] = useState<RecruitmentResult[]>([]);
  const [phones, setPhones] = useState<CandidatePhone[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [vacancyStatusFilter, setVacancyStatusFilter] = useState<string>('all');
  const [candidateStageFilter, setCandidateStageFilter] = useState<string>('all');

  // Modals
  const [showVacancyModal, setShowVacancyModal] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [showJobTitleModal, setShowJobTitleModal] = useState(false);
  const [scoringCandidate, setScoringCandidate] = useState<Candidate | null>(null);
  const [hiringCandidate, setHiringCandidate] = useState<Candidate | null>(null);

  // Forms
  const [vacancyForm, setVacancyForm] = useState({
    job_id: '',
    new_job_title: '',
    status: 'Open',
    type: 'Full-Time',
    no_of_positions: '1',
    posted_date: new Date().toISOString().slice(0, 10),
    closing_date: '',
    description: ''
  });

  const [candidateForm, setCandidateForm] = useState({
    f_name: '',
    l_name: '',
    email: '',
    phone: '',
    vacancy_id: '',
    source: 'Career Portal',
    application_date: new Date().toISOString().slice(0, 10)
  });

  const [scoreForm, setScoreForm] = useState({
    exam_score: '',
    interview_score: '',
    status: 'Shortlisted'
  });

  const [hireForm, setHireForm] = useState({
    f_name: '',
    l_name: '',
    email: '',
    hire_date: new Date().toISOString().slice(0, 10),
    dept_id: '',
    job_id: '',
    office_id: '',
    manager_id: '',
    gender: '',
    national_id: ''
  });

  const [jobTitleForm, setJobTitleForm] = useState({
    title_name: '',
    exam_type: '',
    job_row: ''
  });

  const loadData = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const baseRequests = [
        request<Vacancy[]>('/data/recruitment/vacancies?limit=300&sort=vacancy_id&order=desc'),
        request<Candidate[]>('/data/recruitment/candidates?limit=500&sort=candidate_id&order=desc'),
        request<RecruitmentResult[]>('/data/recruitment/recruitment_results?limit=500'),
        request<CandidatePhone[]>('/data/recruitment/candidate_phones?limit=500').catch(() => ({ data: [] as CandidatePhone[] })),
        request<JobTitle[]>('/data/recruitment/job_titles?limit=300')
      ] as const;

      const [vacRes, candRes, resRes, phoneRes, titleRes] = await Promise.all(baseRequests);
      setVacancies(vacRes.data || []);
      setCandidates(candRes.data || []);
      setResults(resRes.data || []);
      setPhones(phoneRes.data || []);
      setJobTitles(titleRes.data || []);

      if (canManage) {
        const [deptRes, officeRes, empRes] = await Promise.all([
          request<Department[]>('/data/org/departments?limit=150').catch(() => ({ data: [] as Department[] })),
          request<Office[]>('/data/org/offices?limit=100').catch(() => ({ data: [] as Office[] })),
          request<Employee[]>('/data/org/employee?limit=300').catch(() => ({ data: [] as Employee[] }))
        ]);
        setDepartments(deptRes.data || []);
        setOffices(officeRes.data || []);
        setEmployees(empRes.data || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load recruitment records');
    } finally {
      setLoading(false);
    }
  }, [canView, canManage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Derived lookups
  const jobTitleMap = useMemo(() => new Map(jobTitles.map((j) => [j.job_id, j])), [jobTitles]);
  const vacancyMap = useMemo(() => new Map(vacancies.map((v) => [v.vacancy_id, v])), [vacancies]);

  const resultByCandidate = useMemo(() => {
    const map = new Map<number, RecruitmentResult>();
    for (const r of results) map.set(r.candidate_id, r);
    return map;
  }, [results]);

  const phoneByCandidate = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of phones) {
      if (!map.has(p.candidate_id) || p.is_primary) map.set(p.candidate_id, p.phone_number);
    }
    return map;
  }, [phones]);

  const applicantCountByVacancy = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of candidates) {
      if (c.vacancy_id) map.set(c.vacancy_id, (map.get(c.vacancy_id) || 0) + 1);
    }
    return map;
  }, [candidates]);

  const stats = useMemo(() => {
    const openVacancies = vacancies.filter((v) => v.status === 'Open');
    const totalPositions = openVacancies.reduce((sum, v) => sum + Number(v.no_of_positions || 1), 0);
    const activePipeline = results.filter((r) => ['Shortlisted', 'Interviewing', 'Offered'].includes(r.status)).length;
    const hired = results.filter((r) => r.status === 'Hired').length;
    return {
      openVacancyCount: openVacancies.length,
      openPositions: totalPositions,
      totalCandidates: candidates.length,
      activePipeline,
      hired
    };
  }, [vacancies, candidates, results]);

  const openCreateVacancyModal = () => {
    setEditingVacancy(null);
    setVacancyForm({
      job_id: jobTitles[0] ? String(jobTitles[0].job_id) : '',
      new_job_title: '',
      status: 'Open',
      type: 'Full-Time',
      no_of_positions: '1',
      posted_date: new Date().toISOString().slice(0, 10),
      closing_date: '',
      description: ''
    });
    setError('');
    setShowVacancyModal(true);
  };

  const openEditVacancyModal = (v: Vacancy) => {
    setEditingVacancy(v);
    setVacancyForm({
      job_id: v.job_id ? String(v.job_id) : '',
      new_job_title: '',
      status: v.status || 'Open',
      type: v.type || 'Full-Time',
      no_of_positions: String(v.no_of_positions ?? 1),
      posted_date: v.posted_date ? v.posted_date.slice(0, 10) : '',
      closing_date: v.closing_date ? v.closing_date.slice(0, 10) : '',
      description: v.description || ''
    });
    setError('');
    setShowVacancyModal(true);
  };

  const handleSaveVacancy = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      let resolvedJobId = vacancyForm.job_id ? Number(vacancyForm.job_id) : null;
      if (vacancyForm.job_id === '__new__' && vacancyForm.new_job_title.trim()) {
        const createdTitle = await request<JobTitle>('/data/recruitment/job_titles', {
          method: 'POST',
          body: JSON.stringify({ title_name: vacancyForm.new_job_title.trim() })
        });
        resolvedJobId = createdTitle.data.job_id;
      }

      const payload = {
        job_id: resolvedJobId,
        status: vacancyForm.status,
        type: vacancyForm.type,
        no_of_positions: Number(vacancyForm.no_of_positions || 1),
        posted_date: vacancyForm.posted_date || null,
        closing_date: vacancyForm.closing_date || null,
        description: vacancyForm.description.trim() || null
      };

      if (editingVacancy) {
        await request(`/data/recruitment/vacancies/${editingVacancy.vacancy_id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        setSuccess(`Vacancy #${editingVacancy.vacancy_id} updated.`);
      } else {
        await request('/data/recruitment/vacancies', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setSuccess('New job vacancy posted.');
      }
      setShowVacancyModal(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save vacancy');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCandidate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const candRes = await request<Candidate>('/data/recruitment/candidates', {
        method: 'POST',
        body: JSON.stringify({
          f_name: candidateForm.f_name.trim(),
          l_name: candidateForm.l_name.trim(),
          email: candidateForm.email.trim() || null,
          vacancy_id: candidateForm.vacancy_id ? Number(candidateForm.vacancy_id) : null,
          source: candidateForm.source || null,
          application_date: candidateForm.application_date || null
        })
      });

      const createdId = candRes.data.candidate_id;
      const followUps: Promise<unknown>[] = [
        request('/data/recruitment/recruitment_results', {
          method: 'POST',
          body: JSON.stringify({ candidate_id: createdId, status: 'Pending' })
        })
      ];
      if (candidateForm.phone.trim()) {
        followUps.push(
          request('/data/recruitment/candidate_phones', {
            method: 'POST',
            body: JSON.stringify({
              candidate_id: createdId,
              phone_type: 'Mobile',
              phone_number: candidateForm.phone.trim(),
              is_primary: true
            })
          })
        );
      }
      await Promise.all(followUps);

      setSuccess(`Candidate ${candidateForm.f_name} ${candidateForm.l_name} added to pipeline.`);
      setShowCandidateModal(false);
      setCandidateForm({
        f_name: '',
        l_name: '',
        email: '',
        phone: '',
        vacancy_id: '',
        source: 'Career Portal',
        application_date: new Date().toISOString().slice(0, 10)
      });
      setActiveTab('candidates');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register candidate');
    } finally {
      setSubmitting(false);
    }
  };

  const openScoreModal = (c: Candidate) => {
    const existing = resultByCandidate.get(c.candidate_id);
    setScoringCandidate(c);
    setScoreForm({
      exam_score: existing?.exam_score != null ? String(existing.exam_score) : '',
      interview_score: existing?.interview_score != null ? String(existing.interview_score) : '',
      status: existing?.status || 'Shortlisted'
    });
    setError('');
  };

  const handleSaveScore = async (e: FormEvent) => {
    e.preventDefault();
    if (!scoringCandidate) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const existing = resultByCandidate.get(scoringCandidate.candidate_id);
      const payload = {
        candidate_id: scoringCandidate.candidate_id,
        exam_score: scoreForm.exam_score !== '' ? Number(scoreForm.exam_score) : null,
        interview_score: scoreForm.interview_score !== '' ? Number(scoreForm.interview_score) : null,
        status: scoreForm.status
      };

      if (existing) {
        await request(`/data/recruitment/recruitment_results/${existing.result_id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        await request('/data/recruitment/recruitment_results', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setSuccess(`Evaluation updated for ${scoringCandidate.f_name} ${scoringCandidate.l_name}.`);
      setScoringCandidate(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save evaluation');
    } finally {
      setSubmitting(false);
    }
  };

  const openHireModal = (c: Candidate) => {
    const vac = c.vacancy_id ? vacancyMap.get(c.vacancy_id) : null;
    setHiringCandidate(c);
    setHireForm({
      f_name: c.f_name,
      l_name: c.l_name,
      email: c.email || '',
      hire_date: new Date().toISOString().slice(0, 10),
      dept_id: departments[0] ? String(departments[0].dept_id) : '',
      job_id: vac?.job_id ? String(vac.job_id) : '',
      office_id: offices[0] ? String(offices[0].office_id) : '',
      manager_id: '',
      gender: '',
      national_id: ''
    });
    setError('');
  };

  const handleHireCandidate = async (e: FormEvent) => {
    e.preventDefault();
    if (!hiringCandidate) return;
    if (!hireForm.email.trim()) {
      setError('Work email address is required to create the employee profile.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await request(`/workflows/recruitment/candidates/${hiringCandidate.candidate_id}/hire`, {
        method: 'POST',
        body: JSON.stringify({
          f_name: hireForm.f_name.trim(),
          l_name: hireForm.l_name.trim(),
          email: hireForm.email.trim(),
          hire_date: hireForm.hire_date,
          dept_id: hireForm.dept_id ? Number(hireForm.dept_id) : null,
          job_id: hireForm.job_id ? Number(hireForm.job_id) : null,
          office_id: hireForm.office_id ? Number(hireForm.office_id) : null,
          manager_id: hireForm.manager_id ? Number(hireForm.manager_id) : null,
          gender: hireForm.gender || null,
          national_id: hireForm.national_id.trim() || null
        })
      });
      setSuccess(`${hireForm.f_name} ${hireForm.l_name} hired! Employee profile created and vacancy updated.`);
      setHiringCandidate(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to convert candidate to employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddJobTitle = async (e: FormEvent) => {
    e.preventDefault();
    if (!jobTitleForm.title_name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await request('/data/recruitment/job_titles', {
        method: 'POST',
        body: JSON.stringify({
          title_name: jobTitleForm.title_name.trim(),
          exam_type: jobTitleForm.exam_type.trim() || null,
          job_row: jobTitleForm.job_row ? Number(jobTitleForm.job_row) : null
        })
      });
      setSuccess(`Job title "${jobTitleForm.title_name.trim()}" added.`);
      setShowJobTitleModal(false);
      setJobTitleForm({ title_name: '', exam_type: '', job_row: '' });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add job title');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredVacancies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vacancies.filter((v) => {
      if (vacancyStatusFilter !== 'all' && v.status !== vacancyStatusFilter) return false;
      if (!q) return true;
      const title = v.job_id ? jobTitleMap.get(v.job_id)?.title_name || '' : '';
      return (
        String(v.vacancy_id).includes(q) ||
        title.toLowerCase().includes(q) ||
        (v.type || '').toLowerCase().includes(q) ||
        (v.description || '').toLowerCase().includes(q)
      );
    });
  }, [vacancies, vacancyStatusFilter, searchQuery, jobTitleMap]);

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return candidates.filter((c) => {
      const stage = resultByCandidate.get(c.candidate_id)?.status || 'Pending';
      if (candidateStageFilter !== 'all' && stage !== candidateStageFilter) return false;
      if (!q) return true;
      const vac = c.vacancy_id ? vacancyMap.get(c.vacancy_id) : null;
      const title = vac?.job_id ? jobTitleMap.get(vac.job_id)?.title_name || '' : '';
      return (
        `${c.f_name} ${c.l_name}`.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.source || '').toLowerCase().includes(q) ||
        title.toLowerCase().includes(q)
      );
    });
  }, [candidates, candidateStageFilter, searchQuery, resultByCandidate, vacancyMap, jobTitleMap]);

  if (!canView) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <h2>Restricted Access</h2>
        <p style={{ color: '#9898a8' }}>Recruitment management requires HR or Recruitment Viewer permissions.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="eyebrow">People & Talent Acquisition</span>
          <h1 style={{ margin: '0.2rem 0', fontSize: '1.8rem', fontWeight: 700 }}>
            Recruitment & Hiring Pipeline
          </h1>
          <p style={{ margin: 0, color: '#9898a8', fontSize: '0.9rem' }}>
            Publish open requisitions, track candidate exam and interview scores, and convert selected finalists into employees.
          </p>
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="button"
              onClick={() => { setError(''); setShowCandidateModal(true); }}
            >
              + Add Candidate
            </button>
            <button
              type="button"
              className="button primary"
              onClick={openCreateVacancyModal}
            >
              + Post Vacancy
            </button>
          </div>
        )}
      </div>

      {/* Banners */}
      {error && !showVacancyModal && !showCandidateModal && !scoringCandidate && !hiringCandidate && !showJobTitleModal && (
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

      {/* KPI Cards */}
      <div className="stats-grid" style={{ margin: 0 }}>
        <article className="stat-card">
          <span>Open Requisitions</span>
          <strong>{stats.openVacancyCount}</strong>
          <small>{stats.openPositions} open seat{stats.openPositions === 1 ? '' : 's'} remaining</small>
        </article>
        <article className="stat-card">
          <span>Total Candidates</span>
          <strong style={{ color: '#c8c0ff' }}>{stats.totalCandidates}</strong>
          <small>Tracked in talent pool</small>
        </article>
        <article className="stat-card">
          <span>Active Interviews / Offers</span>
          <strong style={{ color: '#ffd27a' }}>{stats.activePipeline}</strong>
          <small>Shortlisted, interviewing, or offered</small>
        </article>
        <article className="stat-card">
          <span>Hired Candidates</span>
          <strong style={{ color: '#8fe3b6' }}>{stats.hired}</strong>
          <small>Converted to employee roster</small>
        </article>
      </div>

      {/* Tabs */}
      <div className="subnav-tabs" style={{ borderBottom: '1px solid #29292f', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`subnav-tab ${activeTab === 'vacancies' ? 'active' : ''}`}
          onClick={() => { setActiveTab('vacancies'); setSearchQuery(''); }}
        >
          📋 Job Vacancies ({vacancies.length})
        </button>
        <button
          type="button"
          className={`subnav-tab ${activeTab === 'candidates' ? 'active' : ''}`}
          onClick={() => { setActiveTab('candidates'); setSearchQuery(''); }}
        >
          🎯 Candidate Pipeline ({candidates.length})
        </button>
        <button
          type="button"
          className={`subnav-tab ${activeTab === 'titles' ? 'active' : ''}`}
          onClick={() => { setActiveTab('titles'); setSearchQuery(''); }}
        >
          🏷️ Job Titles ({jobTitles.length})
        </button>
      </div>

      {/* TAB 1: VACANCIES */}
      {activeTab === 'vacancies' && (
        <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
              <input
                type="text"
                placeholder="Search vacancies by title, type, or description…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ maxWidth: '320px' }}
              />
              <select
                value={vacancyStatusFilter}
                onChange={(e) => setVacancyStatusFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '160px' }}
              >
                <option value="all">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Filled">Filled</option>
                <option value="Closed">Closed</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#9898a8' }}>
              Showing {filteredVacancies.length} of {vacancies.length}
            </span>
          </div>

          {loading ? (
            <p className="loading-cell">Loading job vacancies…</p>
          ) : filteredVacancies.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem' }}>
              <h2>No vacancies found</h2>
              <p style={{ color: '#9898a8' }}>Post an open requisition to begin collecting candidates.</p>
            </div>
          ) : (
            <div className="table-card" style={{ border: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Role / Job Title</th>
                    <th>Type</th>
                    <th>Openings</th>
                    <th>Applicants</th>
                    <th>Posted / Closing</th>
                    <th>Status</th>
                    {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredVacancies.map((v) => {
                    const title = v.job_id ? jobTitleMap.get(v.job_id) : null;
                    const applicants = applicantCountByVacancy.get(v.vacancy_id) || 0;
                    return (
                      <tr key={v.vacancy_id}>
                        <td><strong>#{v.vacancy_id}</strong></td>
                        <td>
                          <strong>{title?.title_name || `Job #${v.job_id || '—'}`}</strong>
                          {v.description && (
                            <small style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {v.description}
                            </small>
                          )}
                        </td>
                        <td><span className="badge-type">{v.type || 'Full-Time'}</span></td>
                        <td><strong>{v.no_of_positions ?? 1}</strong></td>
                        <td>
                          <button
                            type="button"
                            className="button-link"
                            onClick={() => {
                              setActiveTab('candidates');
                              setSearchQuery(title?.title_name || '');
                            }}
                          >
                            {applicants} applicant{applicants === 1 ? '' : 's'}
                          </button>
                        </td>
                        <td>
                          <span>{formatDate(v.posted_date)}</span>
                          <small>Closes {formatDate(v.closing_date)}</small>
                        </td>
                        <td><span className={getStageBadgeClass(v.status)}>{v.status}</span></td>
                        {canManage && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="button btn-sm"
                              onClick={() => openEditVacancyModal(v)}
                            >
                              Edit
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

      {/* TAB 2: CANDIDATES */}
      {activeTab === 'candidates' && (
        <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
              <input
                type="text"
                placeholder="Search candidate name, email, source, or job…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ maxWidth: '320px' }}
              />
              <select
                value={candidateStageFilter}
                onChange={(e) => setCandidateStageFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '170px' }}
              >
                <option value="all">All Stages</option>
                {CANDIDATE_STAGES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#9898a8' }}>
              Showing {filteredCandidates.length} of {candidates.length}
            </span>
          </div>

          {loading ? (
            <p className="loading-cell">Loading candidate pipeline…</p>
          ) : filteredCandidates.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem' }}>
              <h2>No candidates found</h2>
              <p style={{ color: '#9898a8' }}>Register an applicant or adjust your pipeline filters.</p>
            </div>
          ) : (
            <div className="table-card" style={{ border: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Applied Vacancy</th>
                    <th>Source</th>
                    <th>Scores (Exam / Interview)</th>
                    <th>Applied</th>
                    <th>Stage</th>
                    {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((c) => {
                    const vac = c.vacancy_id ? vacancyMap.get(c.vacancy_id) : null;
                    const title = vac?.job_id ? jobTitleMap.get(vac.job_id)?.title_name : null;
                    const res = resultByCandidate.get(c.candidate_id);
                    const stage = res?.status || 'Pending';
                    const phone = phoneByCandidate.get(c.candidate_id);

                    return (
                      <tr key={c.candidate_id}>
                        <td>
                          <strong>{c.f_name} {c.l_name}</strong>
                          <small>{c.email || 'No email'}{phone ? ` · ${phone}` : ''}</small>
                        </td>
                        <td>
                          {c.vacancy_id ? (
                            <>
                              <strong>{title || `Vacancy #${c.vacancy_id}`}</strong>
                              <small>Req #{c.vacancy_id}</small>
                            </>
                          ) : (
                            <span style={{ color: '#777781' }}>General Pool</span>
                          )}
                        </td>
                        <td><span className="badge-type">{c.source || 'Direct'}</span></td>
                        <td>
                          {res && (res.exam_score != null || res.interview_score != null) ? (
                            <span>
                              Exam: <strong>{res.exam_score ?? '—'}</strong> · Int:{' '}
                              <strong>{res.interview_score ?? '—'}</strong>
                            </span>
                          ) : (
                            <span style={{ color: '#777781' }}>Not scored</span>
                          )}
                        </td>
                        <td>{formatDate(c.application_date || c.created_at)}</td>
                        <td><span className={getStageBadgeClass(stage)}>{stage}</span></td>
                        {canManage && (
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                              <button
                                type="button"
                                className="button btn-sm"
                                onClick={() => openScoreModal(c)}
                              >
                                Score / Stage
                              </button>
                              {stage !== 'Hired' && stage !== 'Rejected' && (
                                <button
                                  type="button"
                                  className="button primary btn-sm"
                                  onClick={() => openHireModal(c)}
                                >
                                  Hire
                                </button>
                              )}
                            </div>
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

      {/* TAB 3: JOB TITLES CATALOG */}
      {activeTab === 'titles' && (
        <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>Standard Job Titles</h2>
              <small style={{ color: '#9898a8' }}>Catalog linked to requisitions and employee roles</small>
            </div>
            {canManage && (
              <button
                type="button"
                className="button primary btn-sm"
                onClick={() => { setError(''); setShowJobTitleModal(true); }}
              >
                + Add Job Title
              </button>
            )}
          </div>

          <div className="table-card" style={{ border: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title Name</th>
                  <th>Exam Track</th>
                  <th>Grade / Row</th>
                </tr>
              </thead>
              <tbody>
                {jobTitles.map((jt) => (
                  <tr key={jt.job_id}>
                    <td><strong>#{jt.job_id}</strong></td>
                    <td><strong>{jt.title_name}</strong></td>
                    <td>{jt.exam_type || 'Standard Interview'}</td>
                    <td>{jt.job_row ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODAL: CREATE / EDIT VACANCY */}
      {showVacancyModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-heading">
              <h2>{editingVacancy ? `Edit Vacancy #${editingVacancy.vacancy_id}` : 'Post New Job Vacancy'}</h2>
              <button type="button" onClick={() => setShowVacancyModal(false)} style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}>×</button>
            </div>

            <form onSubmit={handleSaveVacancy} style={{ display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-error">⚠️ {error}</div>}
              <div className="form-grid">
                <label>
                  Job Title
                  <select
                    value={vacancyForm.job_id}
                    onChange={(e) => setVacancyForm((p) => ({ ...p, job_id: e.target.value }))}
                  >
                    <option value="">— Select Job Title —</option>
                    {jobTitles.map((jt) => (
                      <option key={jt.job_id} value={jt.job_id}>{jt.title_name}</option>
                    ))}
                    <option value="__new__">+ Create New Job Title…</option>
                  </select>
                </label>

                {vacancyForm.job_id === '__new__' ? (
                  <label>
                    New Job Title Name *
                    <input
                      required
                      placeholder="e.g. Senior Backend Engineer"
                      value={vacancyForm.new_job_title}
                      onChange={(e) => setVacancyForm((p) => ({ ...p, new_job_title: e.target.value }))}
                    />
                  </label>
                ) : (
                  <label>
                    Employment Type
                    <select
                      value={vacancyForm.type}
                      onChange={(e) => setVacancyForm((p) => ({ ...p, type: e.target.value }))}
                    >
                      {VACANCY_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  Open Positions *
                  <input
                    type="number"
                    min={0}
                    required
                    value={vacancyForm.no_of_positions}
                    onChange={(e) => setVacancyForm((p) => ({ ...p, no_of_positions: e.target.value }))}
                  />
                </label>

                <label>
                  Status *
                  <select
                    value={vacancyForm.status}
                    onChange={(e) => setVacancyForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="Open">Open</option>
                    <option value="Draft">Draft</option>
                    <option value="Filled">Filled</option>
                    <option value="Closed">Closed</option>
                  </select>
                </label>

                <label>
                  Posted Date
                  <input
                    type="date"
                    value={vacancyForm.posted_date}
                    onChange={(e) => setVacancyForm((p) => ({ ...p, posted_date: e.target.value }))}
                  />
                </label>

                <label>
                  Closing Date
                  <input
                    type="date"
                    value={vacancyForm.closing_date}
                    onChange={(e) => setVacancyForm((p) => ({ ...p, closing_date: e.target.value }))}
                  />
                </label>
              </div>

              <label>
                Role Description & Requirements
                <textarea
                  rows={4}
                  placeholder="Key responsibilities, experience level, and qualifications…"
                  value={vacancyForm.description}
                  onChange={(e) => setVacancyForm((p) => ({ ...p, description: e.target.value }))}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="button" onClick={() => setShowVacancyModal(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>
                  {submitting ? 'Saving…' : editingVacancy ? 'Save Vacancy' : 'Publish Vacancy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CANDIDATE */}
      {showCandidateModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '580px' }}>
            <div className="modal-heading">
              <h2>Register New Candidate</h2>
              <button type="button" onClick={() => setShowCandidateModal(false)} style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}>×</button>
            </div>

            <form onSubmit={handleAddCandidate} style={{ display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-error">⚠️ {error}</div>}
              <div className="form-grid">
                <label>
                  First Name *
                  <input
                    required
                    value={candidateForm.f_name}
                    onChange={(e) => setCandidateForm((p) => ({ ...p, f_name: e.target.value }))}
                  />
                </label>
                <label>
                  Last Name *
                  <input
                    required
                    value={candidateForm.l_name}
                    onChange={(e) => setCandidateForm((p) => ({ ...p, l_name: e.target.value }))}
                  />
                </label>
                <label>
                  Email Address
                  <input
                    type="email"
                    value={candidateForm.email}
                    onChange={(e) => setCandidateForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </label>
                <label>
                  Phone Number
                  <input
                    placeholder="+251..."
                    value={candidateForm.phone}
                    onChange={(e) => setCandidateForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </label>
                <label>
                  Target Vacancy
                  <select
                    value={candidateForm.vacancy_id}
                    onChange={(e) => setCandidateForm((p) => ({ ...p, vacancy_id: e.target.value }))}
                  >
                    <option value="">— General Talent Pool —</option>
                    {vacancies.filter((v) => v.status === 'Open').map((v) => (
                      <option key={v.vacancy_id} value={v.vacancy_id}>
                        #{v.vacancy_id} — {v.job_id ? jobTitleMap.get(v.job_id)?.title_name : v.type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Application Source
                  <select
                    value={candidateForm.source}
                    onChange={(e) => setCandidateForm((p) => ({ ...p, source: e.target.value }))}
                  >
                    {CANDIDATE_SOURCES.map((src) => (
                      <option key={src} value={src}>{src}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Application Date
                <input
                  type="date"
                  value={candidateForm.application_date}
                  onChange={(e) => setCandidateForm((p) => ({ ...p, application_date: e.target.value }))}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="button" onClick={() => setShowCandidateModal(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Add Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SCORE & UPDATE STAGE */}
      {scoringCandidate && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-heading">
              <h2>Evaluate: {scoringCandidate.f_name} {scoringCandidate.l_name}</h2>
              <button type="button" onClick={() => setScoringCandidate(null)} style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}>×</button>
            </div>

            <form onSubmit={handleSaveScore} style={{ display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-error">⚠️ {error}</div>}
              <div className="form-grid">
                <label>
                  Written / Technical Exam Score
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    placeholder="0–100"
                    value={scoreForm.exam_score}
                    onChange={(e) => setScoreForm((p) => ({ ...p, exam_score: e.target.value }))}
                  />
                </label>
                <label>
                  Interview Score
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    placeholder="0–100"
                    value={scoreForm.interview_score}
                    onChange={(e) => setScoreForm((p) => ({ ...p, interview_score: e.target.value }))}
                  />
                </label>
              </div>

              <label>
                Pipeline Stage *
                <select
                  value={scoreForm.status}
                  onChange={(e) => setScoreForm((p) => ({ ...p, status: e.target.value }))}
                >
                  {CANDIDATE_STAGES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </label>

              <div className="modal-actions">
                <button type="button" className="button" onClick={() => setScoringCandidate(null)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save Evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HIRE CANDIDATE */}
      {hiringCandidate && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-heading">
              <h2>Hire Candidate → Create Employee</h2>
              <button type="button" onClick={() => setHiringCandidate(null)} style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}>×</button>
            </div>

            <form onSubmit={handleHireCandidate} style={{ display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-error">⚠️ {error}</div>}
              <div
                style={{
                  background: 'rgba(62,207,142,.08)',
                  border: '1px solid rgba(62,207,142,.25)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 0.95rem',
                  fontSize: '0.84rem',
                  color: '#8fe3b6'
                }}
              >
                Converting <strong>{hiringCandidate.f_name} {hiringCandidate.l_name}</strong> creates an active record in <code>org.employee</code>, marks their recruitment stage as <strong>Hired</strong>, and decrements open positions on the linked vacancy.
              </div>

              <div className="form-grid">
                <label>
                  First Name *
                  <input required value={hireForm.f_name} onChange={(e) => setHireForm((p) => ({ ...p, f_name: e.target.value }))} />
                </label>
                <label>
                  Last Name *
                  <input required value={hireForm.l_name} onChange={(e) => setHireForm((p) => ({ ...p, l_name: e.target.value }))} />
                </label>
                <label>
                  Work Email *
                  <input type="email" required value={hireForm.email} onChange={(e) => setHireForm((p) => ({ ...p, email: e.target.value }))} />
                </label>
                <label>
                  Hire / Start Date *
                  <input type="date" required value={hireForm.hire_date} onChange={(e) => setHireForm((p) => ({ ...p, hire_date: e.target.value }))} />
                </label>
                <label>
                  Department
                  <select value={hireForm.dept_id} onChange={(e) => setHireForm((p) => ({ ...p, dept_id: e.target.value }))}>
                    <option value="">— Select Department —</option>
                    {departments.map((d) => (
                      <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Job Title
                  <select value={hireForm.job_id} onChange={(e) => setHireForm((p) => ({ ...p, job_id: e.target.value }))}>
                    <option value="">— Select Job Title —</option>
                    {jobTitles.map((jt) => (
                      <option key={jt.job_id} value={jt.job_id}>{jt.title_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Office Location
                  <select value={hireForm.office_id} onChange={(e) => setHireForm((p) => ({ ...p, office_id: e.target.value }))}>
                    <option value="">— Select Office —</option>
                    {offices.map((o) => (
                      <option key={o.office_id} value={o.office_id}>{o.location_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Reporting Manager
                  <select value={hireForm.manager_id} onChange={(e) => setHireForm((p) => ({ ...p, manager_id: e.target.value }))}>
                    <option value="">— No Direct Manager —</option>
                    {employees.filter((emp) => emp.employment_status === 'Active').map((emp) => (
                      <option key={emp.employee_id} value={emp.employee_id}>{emp.f_name} {emp.l_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Gender
                  <select value={hireForm.gender} onChange={(e) => setHireForm((p) => ({ ...p, gender: e.target.value }))}>
                    <option value="">— Optional —</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label>
                  National ID
                  <input value={hireForm.national_id} onChange={(e) => setHireForm((p) => ({ ...p, national_id: e.target.value }))} />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="button" onClick={() => setHiringCandidate(null)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>
                  {submitting ? 'Onboarding Employee…' : 'Confirm Hire'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD JOB TITLE */}
      {showJobTitleModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '460px' }}>
            <div className="modal-heading">
              <h2>Add Standard Job Title</h2>
              <button type="button" onClick={() => setShowJobTitleModal(false)} style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}>×</button>
            </div>
            <form onSubmit={handleAddJobTitle} style={{ display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-error">⚠️ {error}</div>}
              <label>
                Title Name *
                <input
                  required
                  placeholder="e.g. Product Manager"
                  value={jobTitleForm.title_name}
                  onChange={(e) => setJobTitleForm((p) => ({ ...p, title_name: e.target.value }))}
                />
              </label>
              <div className="form-grid">
                <label>
                  Assessment / Exam Type
                  <input
                    placeholder="e.g. Technical + Case Study"
                    value={jobTitleForm.exam_type}
                    onChange={(e) => setJobTitleForm((p) => ({ ...p, exam_type: e.target.value }))}
                  />
                </label>
                <label>
                  Job Grade / Row
                  <input
                    type="number"
                    value={jobTitleForm.job_row}
                    onChange={(e) => setJobTitleForm((p) => ({ ...p, job_row: e.target.value }))}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="button" onClick={() => setShowJobTitleModal(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>Save Job Title</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
