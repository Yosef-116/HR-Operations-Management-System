import { NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';

const navigation = [
  ['Main', [['/', 'Dashboard'], ['/employees', 'Employees']]],
  ['Payroll & Finance', [['/payroll', 'Payroll'], ['/expenses', 'Expenses']]],
  ['People', [['/leave', 'Leave Requests'], ['/recruitment', 'Recruitment'], ['/performance', 'Performance'], ['/training', 'Training']]],
  ['Operations', [['/assets', 'Assets'], ['/grievances', 'Grievances'], ['/onboarding', 'Onboarding']]]
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const displayName = user?.f_name ? `${user.f_name} ${user.l_name ?? ''}`.trim() : user?.username ?? 'User';
  const initials = displayName.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase();
  const pageName = location.pathname === '/' ? 'Dashboard' : location.pathname.slice(1).replaceAll('-', ' ');

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">W</span><span><strong>WorkForce</strong><small>HR Operations</small></span></div>
      <nav>
        {navigation.map(([section, links]) => <section key={section} className="nav-section">
          <p>{section}</p>
          {links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
        </section>)}
      </nav>
      <div className="account">
        <span className="avatar">{initials}</span><span className="account-copy"><strong>{displayName}</strong><small>{user?.roles[0] ?? 'Employee'}</small></span>
        <button className="button-link" onClick={logout}>Sign out</button>
      </div>
    </aside>
    <main className="main-content">
      <header><h1>{pageName}</h1><span className="environment">React migration</span></header>
      <div className="page-content">{children}</div>
    </main>
  </div>;
}
