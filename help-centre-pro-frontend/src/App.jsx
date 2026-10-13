import { Navigate, Route, Routes } from "react-router-dom";
import AdminShell from "./components/admin/AdminShell.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import ProtectedRoute from "./components/layout/ProtectedRoute.jsx";
import { isAdminPortal, isTenantPortal } from "./config/env.js";
import AcceptInvitation from "./pages/auth/AcceptInvitation.jsx";
import ChangePassword from "./pages/auth/ChangePassword.jsx";
import CheckEmail from "./pages/auth/CheckEmail.jsx";
import CreatePassword from "./pages/auth/CreatePassword.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import Login from "./pages/auth/Login.jsx";
import PortalAccessDenied from "./pages/auth/PortalAccessDenied.jsx";
import ResetPassword from "./pages/auth/ResetPassword.jsx";
import Signup from "./pages/auth/Signup.jsx";
import VerifyEmail from "./pages/auth/VerifyEmail.jsx";
import Agents from "./pages/agents/Agents.jsx";
import AdminLogin from "./pages/admin/AdminLogin.jsx";
import PlatformOverview from "./pages/admin/PlatformOverview.jsx";
import Tenants from "./pages/admin/Tenants.jsx";
import Dashboard from "./pages/dashboard/Dashboard.jsx";
import NewTicket from "./pages/tickets/NewTicket.jsx";
import Tickets from "./pages/tickets/Tickets.jsx";

export default function App() {
  // Tenant host: never expose admin signup/login/shell (and never leak admin URL).
  if (isTenantPortal) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/create-password" element={<CreatePassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/accept-invitation" element={<AcceptInvitation />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute tenantOnly>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/new" element={<NewTicket />} />
          <Route
            path="/agents"
            element={
              <ProtectedRoute permission="agent:read" tenantOnly>
                <Agents />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="/signup" element={<PortalAccessDenied />} />
        <Route path="/admin/*" element={<PortalAccessDenied />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Admin host: platform operators only.
  if (isAdminPortal) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute providerOnly>
              <AdminShell />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
          <Route path="/admin/overview" element={<PlatformOverview />} />
          <Route path="/admin/tenants" element={<Tenants />} />
          <Route path="/overview" element={<Navigate to="/admin/overview" replace />} />
          <Route path="/tenants" element={<Navigate to="/admin/tenants" replace />} />
        </Route>

        <Route
          path="/dashboard"
          element={
            <PortalAccessDenied
              title="Workspace portal only"
              message="Workspace tools live on the tenant application. This host is reserved for platform administration."
            />
          }
        />
        <Route path="/tickets/*" element={<PortalAccessDenied title="Workspace portal only" />} />
        <Route path="/agents" element={<PortalAccessDenied title="Workspace portal only" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Combined (local development): both portals on one origin.
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/check-email" element={<CheckEmail />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/create-password" element={<CreatePassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute providerOnly>
            <AdminShell />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
        <Route path="/admin/overview" element={<PlatformOverview />} />
        <Route path="/admin/tenants" element={<Tenants />} />
      </Route>

      <Route
        element={
          <ProtectedRoute tenantOnly>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/tickets/new" element={<NewTicket />} />
        <Route
          path="/agents"
          element={
            <ProtectedRoute permission="agent:read" tenantOnly>
              <Agents />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
