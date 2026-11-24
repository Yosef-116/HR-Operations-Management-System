import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { request } from '../../api';
import { useAuth } from '../../auth';
import type {
  Employee,
  JobTitle,
  PerformanceGoal,
  PerformancePlan,
  PerformanceReview,
  Promotion,
  PromotionApprovalLog,
  PromotionAssessment,
  SalaryContract,
  SalaryMatrix
} from '../../types';

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

function getBadgeClass(status: string): string {
  switch (status) {
    case 'Achieved':
    case 'Approved':
    case 'Closed':
      return 'badge badge-approved';
    case 'Missed':
    case 'Rejected':
      return 'badge badge-open';
    case 'In Progress':
    case 'Active':
      return 'badge badge-review';
    default:
      return 'badge badge-pending';
  }
}

export function PerformancePage() {
  const { user } = useAuth();

  const canEditPerf = useMemo(() => {
    if (!user) return false;
    if (user.roles?.includes('Admin') || user.permissions?.includes('manage_all')) return true;
    return user.permissions?.some((p) => ['edit_performance', 'manage_performance'].includes(p));
  }, [user]);

  const canPromote = useMemo(() => {
    if (!user) return false;
    if (user.roles?.includes('Admin') || user.permissions?.includes('manage_all')) return true;
    return user.permissions?.some((p) => ['approve_promotion', 'manage_people'].includes(p));
  }, [user]);

  const canView = useMemo(() => {
    if (canEditPerf || canPromote) return true;
    return Boolean(user?.permissions?.includes('view_performance'));
  }, [user, canEditPerf, canPromote]);

  const [activeTab, setActiveTab] = useState<'plans' | 'promotions'>('plans');

  const [plans, setPlans] = useState<PerformancePlan[]>([]);
  const [goals, setGoals] = useState<PerformanceGoal[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [assessments, setAssessments] = useState<PromotionAssessment[]>([]);
  const [approvalLogs, setApprovalLogs] = useState<PromotionApprovalLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [salaryMatrix, setSalaryMatrix] = useState<SalaryMatrix[]>([]);
  const [contracts, setContracts] = useState<SalaryContract[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [planStatusFilter, setPlanStatusFilter] = useState<string>('all');
  const [promoStatusFilter, setPromoStatusFilter] = useState<string>('all');

  // Modals
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PerformancePlan | null>(null);
  const [showNominateModal, setShowNominateModal] = useState(false);
  const [assessTarget, setAssessTarget] = useState<Promotion | null>(null);
  const [actionTarget, setActionTarget] = useState<Promotion | null>(null);

  // Forms
  const currentYear = new Date().getFullYear();
  const [planForm, setPlanForm] = useState({
    employee_id: '',
    year: String(currentYear),
    period_start: `${currentYear}-01-01`,
    period_end: `${currentYear}-12-31`,
    plan_status: 'Active'
  });

  const [goalForm, setGoalForm] = useState({
    goal_title: '',
    description: '',
    target_value: '100',
    weight: '25'
  });

  const [goalEvalInputs, setGoalEvalInputs] = useState<Record<number, string>>({});

  const [reviewForm, setReviewForm] = useState({
    reality_score: '',
    overall_rating: '',
    approval_status: 'Approved',
    comments: ''
  });

  const [promoForm, setPromoForm] = useState({
    employee_id: '',
    new_job_id: '',
    new_matrix_id: '',
    promotion_type: 'Merit & Role Upgrade',
    effective_date: new Date().toISOString().slice(0, 10)
  });

  const [assessForm, setAssessForm] = useState({
    performance_review: '85',
    attendance_score: '95',
    yrs_in_role: '2',
    training_completed: true,
    disciplinary_7: false
  });

  const [actionForm, setActionForm] = useState({
    action: 'Approved' as 'Approved' | 'Rejected' | 'Returned',
    notes: '',
    action_date: new Date().toISOString().slice(0, 10)
  });

  const loadData = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [
        plansRes,
        goalsRes,
        reviewsRes,
        empRes,
        jobRes,
        matrixRes,
        contractRes
      ] = await Promise.all([
        request<PerformancePlan[]>('/data/performance/performance_plans?limit=400&sort=plan_id&order=desc'),
        request<PerformanceGoal[]>('/data/performance/performance_goals?limit=500'),
        request<PerformanceReview[]>('/data/performance/performance_review?limit=400').catch(() => ({ data: [] as PerformanceReview[] })),
        request<Employee[]>('/data/org/employee?limit=300').catch(() => ({ data: [] as Employee[] })),
        request<JobTitle[]>('/data/recruitment/job_titles?limit=200').catch(() => ({ data: [] as JobTitle[] })),
        request<SalaryMatrix[]>('/data/payroll/salary_matrix?limit=150').catch(() => ({ data: [] as SalaryMatrix[] })),
        request<SalaryContract[]>('/data/payroll/salary_contracts?limit=300').catch(() => ({ data: [] as SalaryContract[] }))
      ]);

      setPlans(plansRes.data || []);
      setGoals(goalsRes.data || []);
      setReviews(reviewsRes.data || []);
      setEmployees(empRes.data || []);
      setJobTitles(jobRes.data || []);
      setSalaryMatrix(matrixRes.data || []);
      setContracts(contractRes.data || []);

      if (canPromote) {
        const [promoRes, assessRes, logRes] = await Promise.all([
          request<Promotion[]>('/data/people/promotions?limit=400&sort=promotion_id&order=desc').catch(() => ({ data: [] as Promotion[] })),
          request<PromotionAssessment[]>('/data/people/promotion_criteria_assessment?limit=500').catch(() => ({ data: [] as PromotionAssessment[] })),
          request<PromotionApprovalLog[]>('/data/people/promotionapproval_log?limit=500').catch(() => ({ data: [] as PromotionApprovalLog[] }))
        ]);
        setPromotions(promoRes.data || []);
        setAssessments(assessRes.data || []);
        setApprovalLogs(logRes.data || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load performance & promotion records');
    } finally {
      setLoading(false);
    }
  }, [canView, canPromote]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Maps
  const empMap = useMemo(() => new Map(employees.map((e) => [e.employee_id, e])), [employees]);
  const jobMap = useMemo(() => new Map(jobTitles.map((j) => [j.job_id, j.title_name])), [jobTitles]);
  const matrixMap = useMemo(() => new Map(salaryMatrix.map((m) => [m.matrix_id, m])), [salaryMatrix]);

  const activeContractByEmp = useMemo(() => {
    const map = new Map<number, SalaryContract>();
    for (const c of contracts) {
      if (c.is_active) map.set(c.employee_id, c);
    }
    return map;
  }, [contracts]);

  const goalsByPlan = useMemo(() => {
    const map = new Map<number, PerformanceGoal[]>();
    for (const g of goals) {
      const list = map.get(g.plan_id) || [];
      list.push(g);
      map.set(g.plan_id, list);
    }
    return map;
  }, [goals]);

  const reviewsByPlan = useMemo(() => {
    const map = new Map<number, PerformanceReview[]>();
    for (const r of reviews) {
      const list = map.get(r.plan_id) || [];
      list.push(r);
      map.set(r.plan_id, list);
    }
    return map;
  }, [reviews]);

  const latestAssessmentByPromo = useMemo(() => {
    const map = new Map<number, PromotionAssessment>();
    for (const a of assessments) {
      map.set(a.promotion_id, a);
    }
    return map;
  }, [assessments]);

  const latestLogByPromo = useMemo(() => {
    const map = new Map<number, PromotionApprovalLog>();
    for (const l of approvalLogs) {
      map.set(l.promotion_id, l);
    }
    return map;
  }, [approvalLogs]);

  const stats = useMemo(() => {
    const activePlans = plans.filter((p) => p.plan_status !== 'Closed').length;
    const closedPlans = plans.filter((p) => p.plan_status === 'Closed').length;
    const achievedGoals = goals.filter((g) => g.status === 'Achieved').length;
    const pendingPromos = promotions.filter((p) => p.status === 'Pending').length;
    return { activePlans, closedPlans, achievedGoals, totalGoals: goals.length, pendingPromos };
  }, [plans, goals, promotions]);

  const computedPreviewScore = useMemo(() => {
    const perf = Number(assessForm.performance_review || 0);
    const att = Number(assessForm.attendance_score || 0);
    const train = assessForm.training_completed ? 100 : 0;
    const yrs = Math.min(Number(assessForm.yrs_in_role || 0) * 10, 100);
    const penalty = assessForm.disciplinary_7 ? 15 : 0;
    return Math.max(0, perf * 0.4 + att * 0.25 + train * 0.2 + yrs * 0.15 - penalty).toFixed(2);
  }, [assessForm]);

  const openPlanDrawer = (plan: PerformancePlan) => {
    setSelectedPlan(plan);
    const planGoals = goalsByPlan.get(plan.plan_id) || [];
    const evals: Record<number, string> = {};
    for (const g of planGoals) {
      evals[g.goal_id] = g.actual_value != null ? String(g.actual_value) : '';
    }
    setGoalEvalInputs(evals);
    setGoalForm({ goal_title: '', description: '', target_value: '100', weight: '25' });
    setReviewForm({ reality_score: '', overall_rating: '', approval_status: 'Approved', comments: '' });
    setError('');
  };

  const handleCreatePlan = async (e: FormEvent) => {
    e.preventDefault();
    if (!planForm.employee_id) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await request('/data/performance/performance_plans', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(planForm.employee_id),
          year: Number(planForm.year),
          period_start: planForm.period_start,
          period_end: planForm.period_end,
          plan_status: planForm.plan_status,
          created_by: user?.employee_id || null
        })
      });
      setSuccess('Performance review plan created.');
      setShowCreatePlanModal(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create performance plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddGoal = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !goalForm.goal_title.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await request('/data/performance/performance_goals', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: selectedPlan.plan_id,
          goal_title: goalForm.goal_title.trim(),
          description: goalForm.description.trim() || null,
          target_value: Number(goalForm.target_value || 100),
          weight: Number(goalForm.weight || 0),
          status: 'Pending'
        })
      });
      setSuccess(`KPI goal "${goalForm.goal_title.trim()}" added.`);
      setGoalForm({ goal_title: '', description: '', target_value: '100', weight: '25' });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add KPI goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEvaluateGoal = async (goalId: number) => {
    const val = goalEvalInputs[goalId];
    if (val === undefined || val === '') {
      setError('Enter an actual achievement score before evaluating.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await request(`/workflows/performance/goals/${goalId}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({ actual_value: Number(val) })
      });
      setSuccess('Goal evaluated and status updated.');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClosePlan = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await request<{ plan: PerformancePlan; overall_rating: number }>(
        `/workflows/performance/plans/${selectedPlan.plan_id}/close`,
        { method: 'POST' }
      );
      setSuccess(`Plan #${selectedPlan.plan_id} closed with weighted score ${res.data.overall_rating}%.`);
      setSelectedPlan(res.data.plan);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to close performance plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    setSubmitting(true);
    setError('');
    try {
      await request('/data/performance/performance_review', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: selectedPlan.plan_id,
          reviewer_id: user?.employee_id || null,
          review_date: new Date().toISOString().slice(0, 10),
          reality_score: reviewForm.reality_score !== '' ? Number(reviewForm.reality_score) : null,
          overall_rating: reviewForm.overall_rating !== '' ? Number(reviewForm.overall_rating) : null,
          approval_status: reviewForm.approval_status,
          comments: reviewForm.comments.trim() || null
        })
      });
      setSuccess('Qualitative performance review logged.');
      setReviewForm({ reality_score: '', overall_rating: '', approval_status: 'Approved', comments: '' });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNominatePromotion = async (e: FormEvent) => {
    e.preventDefault();
    if (!promoForm.employee_id) return;
    const empId = Number(promoForm.employee_id);
    const emp = empMap.get(empId);
    const currentContract = activeContractByEmp.get(empId);

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await request('/data/people/promotions', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: empId,
          old_job_id: emp?.job_id || null,
          new_job_id: promoForm.new_job_id ? Number(promoForm.new_job_id) : null,
          old_matrix_id: currentContract?.matrix_id || null,
          new_matrix_id: promoForm.new_matrix_id ? Number(promoForm.new_matrix_id) : null,
          promotion_type: promoForm.promotion_type,
          effective_date: promoForm.effective_date,
          status: 'Pending'
        })
      });
      setSuccess('Promotion nomination submitted for criteria assessment.');
      setShowNominateModal(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit promotion nomination');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssessPromotion = async (e: FormEvent) => {
    e.preventDefault();
    if (!assessTarget) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await request<PromotionAssessment>(`/workflows/promotions/${assessTarget.promotion_id}/assess`, {
        method: 'POST',
        body: JSON.stringify({
          performance_review: Number(assessForm.performance_review),
          attendance_score: Number(assessForm.attendance_score),
          yrs_in_role: Number(assessForm.yrs_in_role),
          training_completed: assessForm.training_completed,
          disciplinary_7: assessForm.disciplinary_7
        })
      });
      setSuccess(`Assessment saved for Promotion #${assessTarget.promotion_id} (Score: ${res.data.overall_score}).`);
      setAssessTarget(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromotionAction = async (e: FormEvent) => {
    e.preventDefault();
    if (!actionTarget) return;
    setSubmitting(true);
    setError('');
    try {
      await request(`/workflows/promotions/${actionTarget.promotion_id}/action`, {
        method: 'POST',
        body: JSON.stringify({
          action: actionForm.action,
          notes: actionForm.notes.trim() || null,
          action_date: actionForm.action_date
        })
      });
      setSuccess(`Promotion #${actionTarget.promotion_id} marked as ${actionForm.action}.`);
      setActionTarget(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process promotion decision');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPlans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return plans.filter((p) => {
      if (planStatusFilter !== 'all' && p.plan_status !== planStatusFilter) return false;
      if (!q) return true;
      const emp = empMap.get(p.employee_id);
      const empName = emp ? `${emp.f_name} ${emp.l_name}`.toLowerCase() : '';
      return String(p.plan_id).includes(q) || String(p.year).includes(q) || empName.includes(q);
    });
  }, [plans, planStatusFilter, searchQuery, empMap]);

  const filteredPromotions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return promotions.filter((p) => {
      if (promoStatusFilter !== 'all' && p.status !== promoStatusFilter) return false;
      if (!q) return true;
      const emp = empMap.get(p.employee_id);
      const empName = emp ? `${emp.f_name} ${emp.l_name}`.toLowerCase() : '';
      return String(p.promotion_id).includes(q) || p.promotion_type.toLowerCase().includes(q) || empName.includes(q);
    });
  }, [promotions, promoStatusFilter, searchQuery, empMap]);

  const activeEmployees = useMemo(() => employees.filter((e) => e.employment_status === 'Active'), [employees]);

  if (!canView) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <h2>Restricted Access</h2>
        <p style={{ color: '#9898a8' }}>Performance & promotion workflows require Manager or HR permissions.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="eyebrow">People & Career Progression</span>
          <h1 style={{ margin: '0.2rem 0', fontSize: '1.8rem', fontWeight: 700 }}>
            Performance & Promotions
          </h1>
          <p style={{ margin: 0, color: '#9898a8', fontSize: '0.9rem' }}>
            Manage employee review cycles, weighted KPI goal evaluations, and merit-based promotion approvals.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {canPromote && (
            <button
              type="button"
              className="button"
              onClick={() => {
                setError('');
                setPromoForm({
                  employee_id: activeEmployees[0] ? String(activeEmployees[0].employee_id) : '',
                  new_job_id: '',
                  new_matrix_id: '',
                  promotion_type: 'Merit & Role Upgrade',
                  effective_date: new Date().toISOString().slice(0, 10)
                });
                setShowNominateModal(true);
              }}
            >
              ★ Nominate Promotion
            </button>
          )}
          {canEditPerf && (
            <button
              type="button"
              className="button primary"
              onClick={() => {
                setError('');
                setPlanForm({
                  employee_id: activeEmployees[0] ? String(activeEmployees[0].employee_id) : '',
                  year: String(currentYear),
                  period_start: `${currentYear}-01-01`,
                  period_end: `${currentYear}-12-31`,
                  plan_status: 'Active'
                });
                setShowCreatePlanModal(true);
              }}
            >
              + New Review Plan
            </button>
          )}
        </div>
      </div>

      {error && !showCreatePlanModal && !selectedPlan && !showNominateModal && !assessTarget && !actionTarget && (
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
          <span>Active Review Plans</span>
          <strong>{stats.activePlans}</strong>
          <small>{stats.closedPlans} finalized cycles</small>
        </article>
        <article className="stat-card">
          <span>KPI Goals Tracked</span>
          <strong style={{ color: '#c8c0ff' }}>{stats.totalGoals}</strong>
          <small>{stats.achievedGoals} achieved target</small>
        </article>
        <article className="stat-card">
          <span>Goal Attainment Rate</span>
          <strong style={{ color: '#8fe3b6' }}>
            {stats.totalGoals > 0 ? Math.round((stats.achievedGoals / stats.totalGoals) * 100) : 0}%
          </strong>
          <small>Evaluated objectives</small>
        </article>
        {canPromote && (
          <article className="stat-card">
            <span>Pending Promotions</span>
            <strong style={{ color: '#ffd27a' }}>{stats.pendingPromos}</strong>
            <small>{promotions.length} total requests</small>
          </article>
        )}
      </div>

      {/* Tabs */}
      <div className="subnav-tabs" style={{ borderBottom: '1px solid #29292f', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          className={`subnav-tab ${activeTab === 'plans' ? 'active' : ''}`}
          onClick={() => { setActiveTab('plans'); setSearchQuery(''); }}
        >
          📈 Performance Plans ({plans.length})
        </button>
        {canPromote && (
          <button
            type="button"
            className={`subnav-tab ${activeTab === 'promotions' ? 'active' : ''}`}
            onClick={() => { setActiveTab('promotions'); setSearchQuery(''); }}
          >
            🚀 Promotions ({promotions.length})
          </button>
        )}
      </div>

      {/* TAB 1: PERFORMANCE PLANS */}
      {activeTab === 'plans' && (
        <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
              <input
                type="text"
                placeholder="Search by employee, plan ID, or year…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ maxWidth: '300px' }}
              />
              <select
                value={planStatusFilter}
                onChange={(e) => setPlanStatusFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '160px' }}
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#9898a8' }}>
              Showing {filteredPlans.length} of {plans.length} plans
            </span>
          </div>

          {loading ? (
            <p className="loading-cell">Loading performance cycles…</p>
          ) : filteredPlans.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem' }}>
              <h2>No performance plans found</h2>
              <p style={{ color: '#9898a8' }}>Create an employee review plan to set KPIs and evaluate progress.</p>
            </div>
          ) : (
            <div className="table-card" style={{ border: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Employee</th>
                    <th>Cycle Year & Window</th>
                    <th>Goals</th>
                    <th>Reviews</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map((plan) => {
                    const emp = empMap.get(plan.employee_id);
                    const pGoals = goalsByPlan.get(plan.plan_id) || [];
                    const achieved = pGoals.filter((g) => g.status === 'Achieved').length;
                    const pReviews = reviewsByPlan.get(plan.plan_id) || [];

                    return (
                      <tr key={plan.plan_id} className="clickable-row" onClick={() => openPlanDrawer(plan)}>
                        <td><strong>#{plan.plan_id}</strong></td>
                        <td>
                          <strong>{emp ? `${emp.f_name} ${emp.l_name}` : `Employee #${plan.employee_id}`}</strong>
                          <small>{emp?.job_id ? jobMap.get(emp.job_id) || 'Staff' : emp?.email || '—'}</small>
                        </td>
                        <td>
                          <strong>FY {plan.year}</strong>
                          <small>{formatDate(plan.period_start)} → {formatDate(plan.period_end)}</small>
                        </td>
                        <td>
                          <strong>{achieved}/{pGoals.length} achieved</strong>
                          <small>{pGoals.reduce((s, g) => s + Number(g.weight || 0), 0)}% weighted</small>
                        </td>
                        <td>{pReviews.length} review{pReviews.length === 1 ? '' : 's'}</td>
                        <td><span className={getBadgeClass(plan.plan_status)}>{plan.plan_status}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="button btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPlanDrawer(plan);
                            }}
                          >
                            Goals & Review
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

      {/* TAB 2: PROMOTIONS */}
      {activeTab === 'promotions' && canPromote && (
        <section className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
              <input
                type="text"
                placeholder="Search promotions by employee or type…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ maxWidth: '300px' }}
              />
              <select
                value={promoStatusFilter}
                onChange={(e) => setPromoStatusFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '160px' }}
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#9898a8' }}>
              Showing {filteredPromotions.length} of {promotions.length}
            </span>
          </div>

          {loading ? (
            <p className="loading-cell">Loading promotions queue…</p>
          ) : filteredPromotions.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem' }}>
              <h2>No promotion nominations found</h2>
              <p style={{ color: '#9898a8' }}>Nominate a candidate to evaluate eligibility criteria and approve role upgrades.</p>
            </div>
          ) : (
            <div className="table-card" style={{ border: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Employee</th>
                    <th>Role Transition</th>
                    <th>Salary Matrix Change</th>
                    <th>Criteria Score</th>
                    <th>Effective Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Workflow</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPromotions.map((pr) => {
                    const emp = empMap.get(pr.employee_id);
                    const oldJob = pr.old_job_id ? jobMap.get(pr.old_job_id) || `#${pr.old_job_id}` : 'Current';
                    const newJob = pr.new_job_id ? jobMap.get(pr.new_job_id) || `#${pr.new_job_id}` : 'Unchanged';
                    const oldMat = pr.old_matrix_id ? matrixMap.get(pr.old_matrix_id) : null;
                    const newMat = pr.new_matrix_id ? matrixMap.get(pr.new_matrix_id) : null;
                    const assess = latestAssessmentByPromo.get(pr.promotion_id);
                    const log = latestLogByPromo.get(pr.promotion_id);

                    return (
                      <tr key={pr.promotion_id}>
                        <td><strong>#{pr.promotion_id}</strong></td>
                        <td>
                          <strong>{emp ? `${emp.f_name} ${emp.l_name}` : `Employee #${pr.employee_id}`}</strong>
                          <small>{pr.promotion_type}</small>
                        </td>
                        <td>
                          <span>{oldJob} → <strong>{newJob}</strong></span>
                        </td>
                        <td>
                          {newMat ? (
                            <span>
                              {oldMat ? `${oldMat.level}-${oldMat.step}` : '—'} →{' '}
                              <strong style={{ color: '#8fe3b6' }}>
                                {newMat.level}-{newMat.step} ({Number(newMat.base_salary).toLocaleString()} ETB)
                              </strong>
                            </span>
                          ) : (
                            <span style={{ color: '#777781' }}>No grade change</span>
                          )}
                        </td>
                        <td>
                          {assess ? (
                            <span className="badge-type">{assess.overall_score} pts</span>
                          ) : (
                            <span style={{ color: '#777781' }}>Not assessed</span>
                          )}
                        </td>
                        <td>{formatDate(pr.effective_date)}</td>
                        <td>
                          <span className={getBadgeClass(pr.status)}>{pr.status}</span>
                          {log?.notes && <small style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.notes}</small>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {pr.status === 'Pending' ? (
                            <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                              <button
                                type="button"
                                className="button btn-sm"
                                onClick={() => { setError(''); setAssessTarget(pr); }}
                              >
                                Assess
                              </button>
                              <button
                                type="button"
                                className="button primary btn-sm"
                                onClick={() => {
                                  setError('');
                                  setActionForm({ action: 'Approved', notes: '', action_date: new Date().toISOString().slice(0, 10) });
                                  setActionTarget(pr);
                                }}
                              >
                                Decide
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#9898a8' }}>Finalized</span>
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
      )}

      {/* MODAL: CREATE PERFORMANCE PLAN */}
      {showCreatePlanModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="modal-heading">
              <h2>Create Performance Review Plan</h2>
              <button type="button" onClick={() => setShowCreatePlanModal(false)} style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}>×</button>
            </div>
            <form onSubmit={handleCreatePlan} style={{ display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-error">⚠️ {error}</div>}
              <label>
                Employee *
                <select
                  required
                  value={planForm.employee_id}
                  onChange={(e) => setPlanForm((p) => ({ ...p, employee_id: e.target.value }))}
                >
                  <option value="">— Select Employee —</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.f_name} {emp.l_name} ({emp.email})
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-grid">
                <label>
                  Review Year *
                  <input
                    type="number"
                    required
                    value={planForm.year}
                    onChange={(e) => setPlanForm((p) => ({ ...p, year: e.target.value }))}
                  />
                </label>
                <label>
                  Initial Status *
                  <select
                    value={planForm.plan_status}
                    onChange={(e) => setPlanForm((p) => ({ ...p, plan_status: e.target.value }))}
                  >
                    <option value="Active">Active</option>
                    <option value="In Progress">In Progress</option>
                  </select>
                </label>
                <label>
                  Period Start *
                  <input
                    type="date"
                    required
                    value={planForm.period_start}
                    onChange={(e) => setPlanForm((p) => ({ ...p, period_start: e.target.value }))}
                  />
                </label>
                <label>
                  Period End *
                  <input
                    type="date"
                    required
                    value={planForm.period_end}
                    onChange={(e) => setPlanForm((p) => ({ ...p, period_end: e.target.value }))}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="button" onClick={() => setShowCreatePlanModal(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PLAN DRILL-DOWN (GOALS + EVALUATION + REVIEWS + CLOSE) */}
      {selectedPlan && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto' }}>
            {(() => {
              const emp = empMap.get(selectedPlan.employee_id);
              const pGoals = goalsByPlan.get(selectedPlan.plan_id) || [];
              const pReviews = reviewsByPlan.get(selectedPlan.plan_id) || [];
              const isClosed = selectedPlan.plan_status === 'Closed';

              return (
                <div style={{ display: 'grid', gap: '1.2rem' }}>
                  <div className="modal-heading" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <h2 style={{ margin: 0 }}>
                          Plan #{selectedPlan.plan_id} — {emp ? `${emp.f_name} ${emp.l_name}` : `Employee #${selectedPlan.employee_id}`}
                        </h2>
                        <span className={getBadgeClass(selectedPlan.plan_status)}>{selectedPlan.plan_status}</span>
                      </div>
                      <small style={{ color: '#9898a8' }}>
                        FY {selectedPlan.year} ({formatDate(selectedPlan.period_start)} → {formatDate(selectedPlan.period_end)})
                      </small>
                    </div>
                    <button type="button" onClick={() => setSelectedPlan(null)} style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}>×</button>
                  </div>

                  {error && <div className="alert alert-error">⚠️ {error}</div>}
                  {success && <div className="alert alert-success">✅ {success}</div>}

                  {/* KPI Goals Section */}
                  <div style={{ background: '#141418', border: '1px solid #292932', borderRadius: '0.65rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <strong style={{ fontSize: '0.95rem' }}>KPI Goals & Metrics ({pGoals.length})</strong>
                      {canEditPerf && !isClosed && pGoals.length > 0 && (
                        <button
                          type="button"
                          className="button primary btn-sm"
                          disabled={submitting}
                          onClick={handleClosePlan}
                        >
                          Finalize & Close Plan
                        </button>
                      )}
                    </div>

                    {pGoals.length === 0 ? (
                      <p style={{ color: '#9898a8', margin: '0.5rem 0', fontSize: '0.88rem' }}>
                        No KPI goals defined for this plan yet.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.65rem' }}>
                        {pGoals.map((g) => (
                          <div
                            key={g.goal_id}
                            style={{
                              background: '#1c1c22',
                              border: '1px solid #2d2d37',
                              borderRadius: '0.5rem',
                              padding: '0.75rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '0.75rem'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: '220px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <strong>{g.goal_title}</strong>
                                <span className={getBadgeClass(g.status)}>{g.status}</span>
                              </div>
                              {g.description && <small style={{ display: 'block', color: '#9898a8', marginTop: '0.2rem' }}>{g.description}</small>}
                              <small style={{ color: '#b7a9ff' }}>
                                Target: {g.target_value ?? '—'} · Weight: {g.weight ?? 0}% · Actual: {g.actual_value ?? 'Pending'}
                              </small>
                            </div>

                            {canEditPerf && !isClosed && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Actual"
                                  aria-label={`Actual value for ${g.goal_title}`}
                                  value={goalEvalInputs[g.goal_id] ?? ''}
                                  onChange={(e) => setGoalEvalInputs((prev) => ({ ...prev, [g.goal_id]: e.target.value }))}
                                  style={{ width: '95px', padding: '0.35rem 0.5rem' }}
                                />
                                <button
                                  type="button"
                                  className="button btn-sm"
                                  disabled={submitting}
                                  onClick={() => handleEvaluateGoal(g.goal_id)}
                                >
                                  Evaluate
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline Add Goal Form */}
                    {canEditPerf && !isClosed && (
                      <form onSubmit={handleAddGoal} style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid #292932', display: 'grid', gap: '0.65rem' }}>
                        <span className="eyebrow" style={{ fontSize: '0.75rem' }}>+ Add KPI Objective</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem' }}>
                          <input
                            required
                            placeholder="Goal title (e.g. Q3 Delivery SLA)"
                            value={goalForm.goal_title}
                            onChange={(e) => setGoalForm((p) => ({ ...p, goal_title: e.target.value }))}
                          />
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="Target"
                            value={goalForm.target_value}
                            onChange={(e) => setGoalForm((p) => ({ ...p, target_value: e.target.value }))}
                          />
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="Weight %"
                            value={goalForm.weight}
                            onChange={(e) => setGoalForm((p) => ({ ...p, weight: e.target.value }))}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            placeholder="Optional criteria or notes…"
                            value={goalForm.description}
                            onChange={(e) => setGoalForm((p) => ({ ...p, description: e.target.value }))}
                          />
                          <button type="submit" className="button primary btn-sm" disabled={submitting} style={{ whiteSpace: 'nowrap' }}>
                            Add Goal
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Performance Review Feedback */}
                  <div style={{ background: '#141418', border: '1px solid #292932', borderRadius: '0.65rem', padding: '1rem' }}>
                    <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                      Manager Reviews ({pReviews.length})
                    </strong>
                    {pReviews.map((rv) => (
                      <div key={rv.review_id} style={{ padding: '0.65rem', background: '#1c1c22', borderRadius: '0.45rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#9898a8' }}>
                          <span>Reviewed {formatDate(rv.review_date)}</span>
                          <span>Rating: <strong style={{ color: '#8fe3b6' }}>{rv.overall_rating ?? '—'}</strong> · {rv.approval_status}</span>
                        </div>
                        {rv.comments && <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }}>{rv.comments}</p>}
                      </div>
                    ))}

                    {canEditPerf && (
                      <form onSubmit={handleAddReview} style={{ display: 'grid', gap: '0.6rem', marginTop: '0.75rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Reality Score (0–100)"
                            value={reviewForm.reality_score}
                            onChange={(e) => setReviewForm((p) => ({ ...p, reality_score: e.target.value }))}
                          />
                          <input
                            type="number"
                            step="0.01"
                            max={10}
                            placeholder="Rating (e.g. 4.5)"
                            value={reviewForm.overall_rating}
                            onChange={(e) => setReviewForm((p) => ({ ...p, overall_rating: e.target.value }))}
                          />
                          <select
                            value={reviewForm.approval_status}
                            onChange={(e) => setReviewForm((p) => ({ ...p, approval_status: e.target.value }))}
                          >
                            <option value="Approved">Approved</option>
                            <option value="Pending">Pending</option>
                            <option value="Returned">Returned</option>
                          </select>
                        </div>
                        <textarea
                          rows={2}
                          placeholder="Feedback comments and development recommendations…"
                          value={reviewForm.comments}
                          onChange={(e) => setReviewForm((p) => ({ ...p, comments: e.target.value }))}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button type="submit" className="button btn-sm" disabled={submitting}>Log Review Note</button>
                        </div>
                      </form>
                    )}
                  </div>

                  <div className="modal-actions" style={{ marginTop: 0 }}>
                    <button type="button" className="button" onClick={() => setSelectedPlan(null)}>Close</button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: NOMINATE PROMOTION */}
      {showNominateModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '540px' }}>
            <div className="modal-heading">
              <h2>Nominate Employee for Promotion</h2>
              <button type="button" onClick={() => setShowNominateModal(false)} style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}>×</button>
            </div>
            <form onSubmit={handleNominatePromotion} style={{ display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-error">⚠️ {error}</div>}
              <label>
                Employee *
                <select
                  required
                  value={promoForm.employee_id}
                  onChange={(e) => setPromoForm((p) => ({ ...p, employee_id: e.target.value }))}
                >
                  <option value="">— Select Employee —</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.f_name} {emp.l_name} ({emp.job_id ? jobMap.get(emp.job_id) || 'Staff' : 'Staff'})
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-grid">
                <label>
                  New Job Title
                  <select
                    value={promoForm.new_job_id}
                    onChange={(e) => setPromoForm((p) => ({ ...p, new_job_id: e.target.value }))}
                  >
                    <option value="">— Keep Current Role —</option>
                    {jobTitles.map((jt) => (
                      <option key={jt.job_id} value={jt.job_id}>{jt.title_name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  New Salary Matrix Tier
                  <select
                    value={promoForm.new_matrix_id}
                    onChange={(e) => setPromoForm((p) => ({ ...p, new_matrix_id: e.target.value }))}
                  >
                    <option value="">— Keep Current Salary —</option>
                    {salaryMatrix.map((sm) => (
                      <option key={sm.matrix_id} value={sm.matrix_id}>
                        {sm.level} Step {sm.step} — {Number(sm.base_salary).toLocaleString()} ETB
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Promotion Type *
                  <select
                    value={promoForm.promotion_type}
                    onChange={(e) => setPromoForm((p) => ({ ...p, promotion_type: e.target.value }))}
                  >
                    <option value="Merit & Role Upgrade">Merit & Role Upgrade</option>
                    <option value="Seniority Step Increase">Seniority Step Increase</option>
                    <option value="Acting / Leadership">Acting / Leadership</option>
                    <option value="Market Adjustment">Market Adjustment</option>
                  </select>
                </label>

                <label>
                  Effective Date *
                  <input
                    type="date"
                    required
                    value={promoForm.effective_date}
                    onChange={(e) => setPromoForm((p) => ({ ...p, effective_date: e.target.value }))}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="button" onClick={() => setShowNominateModal(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>Submit Nomination</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSESS PROMOTION CRITERIA */}
      {assessTarget && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="modal-heading">
              <h2>Assess Eligibility: Promotion #{assessTarget.promotion_id}</h2>
              <button type="button" onClick={() => setAssessTarget(null)} style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}>×</button>
            </div>
            <form onSubmit={handleAssessPromotion} style={{ display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-error">⚠️ {error}</div>}
              <div className="form-grid">
                <label>
                  Performance Review (0–100) *
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    required
                    value={assessForm.performance_review}
                    onChange={(e) => setAssessForm((p) => ({ ...p, performance_review: e.target.value }))}
                  />
                </label>
                <label>
                  Attendance Score (0–100) *
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    required
                    value={assessForm.attendance_score}
                    onChange={(e) => setAssessForm((p) => ({ ...p, attendance_score: e.target.value }))}
                  />
                </label>
                <label>
                  Years in Current Role *
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    required
                    value={assessForm.yrs_in_role}
                    onChange={(e) => setAssessForm((p) => ({ ...p, yrs_in_role: e.target.value }))}
                  />
                </label>
                <div style={{ display: 'grid', alignContent: 'end' }}>
                  <div className="badge-type" style={{ padding: '0.6rem', textAlign: 'center' }}>
                    Calculated Weighted Score: <strong>{computedPreviewScore}</strong> / 100
                  </div>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ width: '16px', height: '16px' }}
                  checked={assessForm.training_completed}
                  onChange={(e) => setAssessForm((p) => ({ ...p, training_completed: e.target.checked }))}
                />
                <span>Required job training milestones completed (+20 pts)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ width: '16px', height: '16px' }}
                  checked={assessForm.disciplinary_7}
                  onChange={(e) => setAssessForm((p) => ({ ...p, disciplinary_7: e.target.checked }))}
                />
                <span>Active disciplinary action recorded (-15 pts penalty)</span>
              </label>

              <div className="modal-actions">
                <button type="button" className="button" onClick={() => setAssessTarget(null)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>Save Assessment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROMOTION APPROVAL DECISION */}
      {actionTarget && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="modal-heading">
              <h2>Promotion Decision #{actionTarget.promotion_id}</h2>
              <button type="button" onClick={() => setActionTarget(null)} style={{ background: 'none', border: 0, color: '#9898a8', fontSize: '1.4rem' }}>×</button>
            </div>
            <form onSubmit={handlePromotionAction} style={{ display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-error">⚠️ {error}</div>}
              {actionForm.action === 'Approved' && (
                <div
                  style={{
                    background: 'rgba(62,207,142,.08)',
                    border: '1px solid rgba(62,207,142,.25)',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    fontSize: '0.84rem',
                    color: '#8fe3b6'
                  }}
                >
                  Approving automatically updates the employee's job title and activates their new compensation contract starting {formatDate(actionTarget.effective_date)}.
                </div>
              )}

              <div className="form-grid">
                <label>
                  Decision Action *
                  <select
                    value={actionForm.action}
                    onChange={(e) => setActionForm((p) => ({ ...p, action: e.target.value as 'Approved' | 'Rejected' | 'Returned' }))}
                  >
                    <option value="Approved">Approved</option>
                    <option value="Returned">Returned for Revision</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </label>
                <label>
                  Decision Date *
                  <input
                    type="date"
                    required
                    value={actionForm.action_date}
                    onChange={(e) => setActionForm((p) => ({ ...p, action_date: e.target.value }))}
                  />
                </label>
              </div>

              <label>
                Approval Rationale / Notes
                <textarea
                  rows={3}
                  placeholder="Document executive or manager justification…"
                  value={actionForm.notes}
                  onChange={(e) => setActionForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="button" onClick={() => setActionTarget(null)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>Confirm Decision</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
