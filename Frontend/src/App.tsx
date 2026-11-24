import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { EmployeesPage } from './features/employees/EmployeesPage';
import { LeavePage } from './features/leave/LeavePage';
import { ExpensesPage } from './features/expenses/ExpensesPage';
import { PayrollPage } from './features/payroll/PayrollPage';
import { AssetsPage } from './features/assets/AssetsPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { GrievancesPage } from './features/grievances/GrievancesPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { PlaceholderPage } from './components/PlaceholderPage';

function ProtectedApp() {
  const { user, loading } = useAuth();
  if (loading) return <main className="screen-center">Restoring your session…</main>;
  if (!user) return <Navigate to="/login" replace />;

  return <AppLayout>
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="employees" element={<EmployeesPage />} />
      <Route path="leave" element={<LeavePage />} />
      <Route path="expenses" element={<ExpensesPage />} />
      <Route path="payroll" element={<PayrollPage />} />
      <Route path="assets" element={<AssetsPage />} />
      <Route path="onboarding" element={<OnboardingPage />} />
      <Route path="grievances" element={<GrievancesPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path=":module" element={<PlaceholderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </AppLayout>;
}

export function App() {
  const { user, loading } = useAuth();
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage loading={loading} />} />
    <Route path="/*" element={<ProtectedApp />} />
  </Routes>;
}
