import { NavLink, useLocation } from 'react-router-dom';
import { useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '../auth';

/* ------------------------------------------------------------------ */
/*  Declarative, permission-aware navigation model                     */
/* ------------------------------------------------------------------ */

type NavLinkItem = { to: string; label: string; requiredPermissions?: string[]; excludePermissions?: string[] };
type NavSection = { section: string; links: NavLinkItem[] };

const navigation: NavSection[] = [
  {
    section: 'Main',
    links: [
      { to: '/', label: 'Dashboard' },
      { to: '/employees', label: 'Directory' },
    ],
  },
  {
    section: 'Self Service',
    links: [
      { to: '/leave', label: 'Leave Requests', requiredPermissions: ['request_leave', 'approve_leave', 'manage_payroll', 'manage_all'] },
      { to: '/expenses', label: 'Expense Claims', requiredPermissions: ['submit_expense', 'approve_expense', 'manage_payroll', 'manage_all'] },
      { to: '/payroll', label: 'My Payslips', requiredPermissions: ['view_self'], excludePermissions: ['manage_payroll', 'process_payroll', 'view_payroll', 'manage_all'] },
    ],
  },
  {
    section: 'Payroll & Finance',
    links: [
      { to: '/payroll', label: 'Payroll & Runs', requiredPermissions: ['manage_payroll', 'process_payroll', 'view_payroll', 'manage_all'] },
    ],
  },
  {
    section: 'People',
    links: [
      { to: '/recruitment', label: 'Recruitment', requiredPermissions: ['manage_recruitment', 'manage_all'] },
      { to: '/performance', label: 'Performance', requiredPermissions: ['view_performance', 'edit_performance', 'manage_performance', 'manage_all'] },
      { to: '/training', label: 'Training', requiredPermissions: ['manage_training', 'manage_all'] },
    ],
  },
  {
    section: 'Operations',
    links: [
      { to: '/assets', label: 'Assets', requiredPermissions: ['manage_org', 'manage_all'] },
      { to: '/grievances', label: 'Grievances', requiredPermissions: ['resolve_grievance', 'view_self', 'manage_org', 'manage_all'] },
      { to: '/onboarding', label: 'Onboarding', requiredPermissions: ['manage_org', 'manage_all'] },
    ],
  },
];

/** Returns true when user holds at least one of the required permissions and none of the excluded permissions. */
function hasAccess(userPermissions: string[], required?: string[], excluded?: string[]): boolean {
  if (excluded && excluded.some((p) => userPermissions.includes(p))) return false;
  if (!required || required.length === 0) return true;
  return required.some((p) => userPermissions.includes(p));
}

/** Filter navigation to only sections / links the current user can see. */
function getVisibleNavigation(permissions: string[]): NavSection[] {
  return navigation
    .map((section) => ({
      ...section,
      links: section.links.filter((link) => hasAccess(permissions, link.requiredPermissions, link.excludePermissions)),
    }))
    .filter((section) => section.links.length > 0);
}

/* ------------------------------------------------------------------ */
/*  Layout component                                                   */
/* ------------------------------------------------------------------ */

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen((prev) => !prev), []);

  const displayName = user?.f_name ? `${user.f_name} ${user.l_name ?? ''}`.trim() : user?.username ?? 'User';
  const initials = displayName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const pageName = location.pathname === '/' ? 'Dashboard' : location.pathname.slice(1).replaceAll('-', ' ');

  const permissions = user?.permissions ?? [];
  const visibleNav = getVisibleNavigation(permissions);

  return <div className="app-shell">
    {/* Mobile backdrop */}
    {mobileOpen && <div className="sidebar-backdrop" onClick={closeMobile} />}

    <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
      <div className="brand"><span className="brand-mark">W</span><span><strong>WorkForce</strong><small>HR Operations</small></span></div>
      <nav>
        {visibleNav.map(({ section, links }) => <section key={section} className="nav-section">
          <p>{section}</p>
          {links.map(({ to, label }) => <NavLink key={to} to={to} end={to === '/'} onClick={closeMobile}>{label}</NavLink>)}
        </section>)}
      </nav>
      <div className="account">
        <span className="avatar">{initials}</span><span className="account-copy"><strong>{displayName}</strong><small>{user?.roles[0] ?? 'Employee'}</small></span>
        <button className="button-link" onClick={logout}>Sign out</button>
      </div>
    </aside>

    <main className="main-content">
      <header>
        <button className="hamburger" onClick={toggleMobile} aria-label="Toggle navigation">☰</button>
        <h1>{pageName}</h1>
        <span className="environment">WorkForce HR</span>
      </header>
      <div className="page-content">{children}</div>
    </main>
  </div>;
}
