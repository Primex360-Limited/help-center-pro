import { Navigate, Route, Routes } from "react-router-dom";
import AdminShell from "./components/admin/AdminShell.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import ProtectedRoute from "./components/layout/ProtectedRoute.jsx";
import {
  ADMIN_URL,
  APP_URL,
  isAdminPortal,
  isTenantPortal,
} from "./config/env.js";
import AcceptInvitation from "./pages/auth/AcceptInvitation.jsx";
import ChangePassword from "./pages/auth/ChangePassword.jsx";
import CheckEmail from "./pages/auth/CheckEmail.jsx";
import CreatePassword from "./pages/auth/CreatePassword.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import Login from "./pages/auth/Login.jsx";
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

function ExternalRedirect({ to }) {
  if (typeof window !== "undefined" && to.startsWith("http")) {
    window.location.replace(to);
    return null;
  }
  return <Navigate to={to} replace />;
}

function adminHome() {
  return isAdminPortal ? "/login" : "/admin/login";
}

function tenantHome() {
  return isTenantPortal || !isAdminPortal ? "/login" : APP_URL ? `${APP_URL}/login` : "/login";
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate to={isAdminPortal ? "/login" : "/login"} replace />
        }
      />

      <Route
        path="/login"
        element={isAdminPortal ? <AdminLogin /> : <Login />}
      />
      <Route
        path="/signup"
        element={
          isTenantPortal && ADMIN_URL ? (
            <ExternalRedirect to={`${ADMIN_URL}/signup`} />
          ) : (
            <Signup />
          )
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/check-email" element={<CheckEmail />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/create-password" element={<CreatePassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />

      <Route
        path="/admin/login"
        element={
          isTenantPortal && ADMIN_URL ? (
            <ExternalRedirect to={`${ADMIN_URL}/login`} />
          ) : isAdminPortal ? (
            <Navigate to="/login" replace />
          ) : (
            <AdminLogin />
          )
        }
      />

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
        {isAdminPortal ? (
          <>
            <Route path="/overview" element={<Navigate to="/admin/overview" replace />} />
            <Route path="/tenants" element={<Navigate to="/admin/tenants" replace />} />
          </>
        ) : null}
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

      <Route
        path="*"
        element={
          <Navigate
            to={isAdminPortal ? adminHome() : tenantHome()}
            replace
          />
        }
      />
    </Routes>
  );
}
