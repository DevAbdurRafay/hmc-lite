import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layout
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { LoginPage } from './pages/LoginPage';
import { FirstRunSetupPage } from './pages/FirstRunSetupPage';
import { ForceChangePasswordModal } from './pages/ForceChangePasswordModal';
import { AdminDashboard } from './pages/AdminDashboard';
import { HRDashboard } from './pages/HRDashboard';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { EmployeeDirectoryPage } from './pages/EmployeeDirectoryPage';
import AttendanceBoardPage from './pages/AttendanceBoardPage';
import LeaveManagementPage from './pages/LeaveManagementPage';
import PayrollPage from './pages/PayrollPage';
import OrganizationSetupPage from './pages/OrganizationSetupPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import AuditLogPage from './pages/AuditLogPage';
import UserManagementPage from './pages/UserManagementPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0d14]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-mono tracking-wider uppercase">Loading HCM Lite...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const role = user.role?.toLowerCase();
  if (allowedRoles && !allowedRoles.map(r => r.toLowerCase()).includes(role || '')) {
    // Redirect to permitted default route
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'hr') return <Navigate to="/hr" replace />;
    return <Navigate to="/employee" replace />;
  }

  return (
    <>
      {user.must_change_password && <ForceChangePasswordModal />}
      {children}
    </>
  );
};

// Root index redirect based on user role
const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0d14]">
        <div className="w-8 h-8 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = user.role?.toLowerCase();
  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'hr') return <Navigate to="/hr" replace />;
  return <Navigate to="/employee" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<FirstRunSetupPage />} />

        {/* Protected App Routes inside Glassmorphism Layout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<RootRedirect />} />

          {/* Dashboards */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr"
            element={
              <ProtectedRoute allowedRoles={['admin', 'hr']}>
                <HRDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/employee" element={<EmployeeDashboard />} />

          {/* Core Modules */}
          <Route
            path="/employees"
            element={
              <ProtectedRoute allowedRoles={['admin', 'hr']}>
                <EmployeeDirectoryPage />
              </ProtectedRoute>
            }
          />

          <Route path="/attendance" element={<AttendanceBoardPage />} />
          <Route path="/my-attendance" element={<AttendanceBoardPage />} />

          <Route path="/leaves" element={<LeaveManagementPage />} />
          <Route path="/my-leaves" element={<LeaveManagementPage />} />

          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/my-payslips" element={<PayrollPage />} />

          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/logins"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/org-setup"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <OrganizationSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organization"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <OrganizationSetupPage />
              </ProtectedRoute>
            }
          />

          <Route path="/announcements" element={<AnnouncementsPage />} />

          <Route
            path="/audit"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AuditLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AuditLogPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
