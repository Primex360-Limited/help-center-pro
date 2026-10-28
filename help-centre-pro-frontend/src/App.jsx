import { Navigate, Route, Routes } from "react-router-dom";
import AdminShell from "./components/admin/AdminShell.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import ProtectedRoute from "./components/layout/ProtectedRoute.jsx";
import SettingsLayout from "./components/workspace/SettingsLayout.jsx";
import { isAdminPortal, isTenantPortal } from "./config/env.js";
import AcceptInvitation from "./pages/auth/AcceptInvitation.jsx";
import ChangePassword from "./pages/auth/ChangePassword.jsx";
import CheckEmail from "./pages/auth/CheckEmail.jsx";
import CreatePassword from "./pages/auth/CreatePassword.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import Login from "./pages/auth/Login.jsx";
import NewSignup from "./pages/auth/NewSignup.jsx";
import PortalAccessDenied from "./pages/auth/PortalAccessDenied.jsx";
import ProfileSetup from "./pages/auth/ProfileSetup.jsx";
import ResetPassword from "./pages/auth/ResetPassword.jsx";
import VerifyEmail from "./pages/auth/VerifyEmail.jsx";
import Agents from "./pages/agents/Agents.jsx";
import AutomationRuleForm from "./pages/automations/AutomationRuleForm.jsx";
import Automations from "./pages/automations/Automations.jsx";
import AdminLogin from "./pages/admin/AdminLogin.jsx";
import PlatformOverview from "./pages/admin/PlatformOverview.jsx";
import PlatformHowto from "./pages/admin/PlatformHowto.jsx";
import Tenants from "./pages/admin/Tenants.jsx";
import IntegrationDocs from "./pages/docs/IntegrationDocs.jsx";
import PrivacyPolicy from "./pages/docs/PrivacyPolicy.jsx";
import TermsOfService from "./pages/docs/TermsOfService.jsx";
import Analytics from "./pages/analytics/Analytics.jsx";
import Dashboard from "./pages/dashboard/Dashboard.jsx";
import CallsInbox from "./pages/tickets/CallsInbox.jsx";
import CreateEmailTicket from "./pages/tickets/CreateEmailTicket.jsx";
import CreateTicketChooser from "./pages/tickets/CreateTicketChooser.jsx";
import EmailsInbox from "./pages/tickets/EmailsInbox.jsx";
import LiveChat from "./pages/tickets/LiveChat.jsx";
import LogPhoneCall from "./pages/tickets/LogPhoneCall.jsx";
import Tickets from "./pages/tickets/Tickets.jsx";
import Customers from "./pages/customers/Customers.jsx";
import CustomerProfile from "./pages/customers/CustomerProfile.jsx";
import Templates from "./pages/templates/Templates.jsx";
import ApiTokensSettings from "./pages/workspace/ApiTokensSettings.jsx";
import BillingSettings from "./pages/workspace/BillingSettings.jsx";
import BillingUpgrade from "./pages/workspace/BillingUpgrade.jsx";
import ConfigurationSettings from "./pages/workspace/ConfigurationSettings.jsx";
import UserManagement from "./pages/workspace/UserManagement.jsx";
import WebhookSettings from "./pages/workspace/WebhookSettings.jsx";
import WorkspaceProfile from "./pages/workspace/WorkspaceProfile.jsx";
import EmailSettings from "./pages/workspace/EmailSettings.jsx";
import EmailOAuthCallback from "./pages/workspace/EmailOAuthCallback.jsx";
import VoipSettings from "./pages/workspace/VoipSettings.jsx";

const SETTINGS_PERMS = ["settings:read", "settings:write"];

/** Nested settings routes shared by tenant-only and combined trees. */
function SettingsRoutes() {
  return (
    <Route
      element={
        <ProtectedRoute anyOfPermissions={SETTINGS_PERMS} tenantOnly>
          <SettingsLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/workspace/profile" element={<WorkspaceProfile />} />
      <Route
        path="/workspace/settings/general"
        element={<Navigate to="/workspace/profile" replace />}
      />
      <Route path="/workspace/settings/api-tokens" element={<ApiTokensSettings />} />
      <Route path="/workspace/settings/webhooks" element={<WebhookSettings />} />
      <Route path="/workspace/settings/billing" element={<BillingSettings />} />
      <Route
        path="/workspace/settings/billing/upgrade"
        element={<BillingUpgrade />}
      />
      <Route
        path="/workspace/settings/integrations"
        element={<Navigate to="/docs/integration" replace />}
      />
      <Route
        path="/workspace/settings/configuration"
        element={<ConfigurationSettings />}
      />
      <Route path="/workspace/email-settings" element={<EmailSettings />} />
      <Route path="/workspace/voip-settings" element={<VoipSettings />} />
      <Route
        path="/billing"
        element={<Navigate to="/workspace/settings/billing" replace />}
      />
    </Route>
  );
}

export default function App() {
  // Tenant host: never expose admin signup/login/shell (and never leak admin URL).
  if (isTenantPortal) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/signup" replace />} />
        <Route path="/signup" element={<NewSignup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/create-password" element={<CreatePassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/accept-invitation" element={<AcceptInvitation />} />
        <Route path="/profile-setup" element={<ProfileSetup />} />
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
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute permission="ticket:read" tenantOnly>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets"
            element={
              <ProtectedRoute permission="ticket:read" tenantOnly>
                <Tickets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/live-chat"
            element={
              <ProtectedRoute permission="ticket:read" tenantOnly>
                <LiveChat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/emails"
            element={
              <ProtectedRoute permission="ticket:read" tenantOnly>
                <EmailsInbox />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/calls"
            element={
              <ProtectedRoute permission="ticket:read" tenantOnly>
                <CallsInbox />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/new"
            element={
              <ProtectedRoute
                anyOfPermissions={["ticket:create", "ticket:read"]}
                tenantOnly
              >
                <CreateTicketChooser />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/new/email"
            element={
              <ProtectedRoute
                anyOfPermissions={["ticket:create", "ticket:read"]}
                tenantOnly
              >
                <CreateEmailTicket />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/new/call"
            element={
              <ProtectedRoute
                anyOfPermissions={["ticket:create", "ticket:read"]}
                tenantOnly
              >
                <LogPhoneCall />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute
                anyOfPermissions={["ticket:read", "message:create"]}
                tenantOnly
              >
                <Customers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers/:customerKey"
            element={
              <ProtectedRoute
                anyOfPermissions={["ticket:read", "message:create"]}
                tenantOnly
              >
                <CustomerProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates"
            element={
              <ProtectedRoute permission="template:read" tenantOnly>
                <Templates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/automations"
            element={
              <ProtectedRoute
                anyOfPermissions={[
                  "ticket:transfer",
                  "ticket:assign",
                  "ticket:supervise",
                ]}
                tenantOnly
              >
                <Automations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/automations/new"
            element={
              <ProtectedRoute permission="ticket:assign" tenantOnly>
                <Automations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/automations/:ruleId/edit"
            element={
              <ProtectedRoute
                anyOfPermissions={["ticket:transfer", "ticket:assign"]}
                tenantOnly
              >
                <AutomationRuleForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agents"
            element={
              <ProtectedRoute
                anyOfPermissions={["agent:read", "agent:invite"]}
                tenantOnly
              >
                <Agents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute permission="report:read" tenantOnly>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/user-management"
            element={
              <ProtectedRoute
                anyOfPermissions={[
                  "role:read",
                  "role:manage",
                  "agent:read",
                  "agent:invite",
                ]}
                tenantOnly
              >
                <UserManagement />
              </ProtectedRoute>
            }
          />
          {SettingsRoutes()}
          <Route
            path="/settings/email/callback/:provider"
            element={
              <ProtectedRoute
                anyOfPermissions={SETTINGS_PERMS}
                tenantOnly
              >
                <EmailOAuthCallback />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="/docs/integration" element={<IntegrationDocs />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/admin/*" element={<PortalAccessDenied />} />
        <Route path="*" element={<Navigate to="/signup" replace />} />
      </Routes>
    );
  }

  // Admin host: platform operators only.
  if (isAdminPortal) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/admin/signup" element={<Navigate to="/login" replace />} />
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
          <Route path="/admin/howto" element={<PlatformHowto />} />
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
        <Route path="/analytics" element={<PortalAccessDenied title="Workspace portal only" />} />
        <Route path="/automations/*" element={<PortalAccessDenied title="Workspace portal only" />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Combined (local development): both portals on one origin.
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signup" replace />} />
      <Route path="/signup" element={<NewSignup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/signup" element={<Navigate to="/admin/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/check-email" element={<CheckEmail />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/create-password" element={<CreatePassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />
      <Route path="/profile-setup" element={<ProfileSetup />} />
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
        <Route path="/admin/howto" element={<PlatformHowto />} />
      </Route>

      <Route
        element={
          <ProtectedRoute tenantOnly>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute permission="ticket:read" tenantOnly>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets"
          element={
            <ProtectedRoute permission="ticket:read" tenantOnly>
              <Tickets />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/live-chat"
          element={
            <ProtectedRoute permission="ticket:read" tenantOnly>
              <LiveChat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/emails"
          element={
            <ProtectedRoute permission="ticket:read" tenantOnly>
              <EmailsInbox />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/calls"
          element={
            <ProtectedRoute permission="ticket:read" tenantOnly>
              <CallsInbox />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/new"
          element={
            <ProtectedRoute
              anyOfPermissions={["ticket:create", "ticket:read"]}
              tenantOnly
            >
              <CreateTicketChooser />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/new/email"
          element={
            <ProtectedRoute
              anyOfPermissions={["ticket:create", "ticket:read"]}
              tenantOnly
            >
              <CreateEmailTicket />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/new/call"
          element={
            <ProtectedRoute
              anyOfPermissions={["ticket:create", "ticket:read"]}
              tenantOnly
            >
              <LogPhoneCall />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute
              anyOfPermissions={["ticket:read", "message:create"]}
              tenantOnly
            >
              <Customers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers/:customerKey"
          element={
            <ProtectedRoute
              anyOfPermissions={["ticket:read", "message:create"]}
              tenantOnly
            >
              <CustomerProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute permission="template:read" tenantOnly>
              <Templates />
            </ProtectedRoute>
          }
        />
        <Route
          path="/automations"
          element={
            <ProtectedRoute
              anyOfPermissions={[
                "ticket:transfer",
                "ticket:assign",
                "ticket:supervise",
              ]}
              tenantOnly
            >
              <Automations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/automations/new"
          element={
            <ProtectedRoute permission="ticket:assign" tenantOnly>
              <Automations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/automations/:ruleId/edit"
          element={
            <ProtectedRoute
              anyOfPermissions={["ticket:transfer", "ticket:assign"]}
              tenantOnly
            >
              <AutomationRuleForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agents"
          element={
            <ProtectedRoute
              anyOfPermissions={["agent:read", "agent:invite"]}
              tenantOnly
            >
              <Agents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute permission="report:read" tenantOnly>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/user-management"
          element={
            <ProtectedRoute
              anyOfPermissions={[
                "role:read",
                "role:manage",
                "agent:read",
                "agent:invite",
              ]}
              tenantOnly
            >
              <UserManagement />
            </ProtectedRoute>
          }
        />
        {SettingsRoutes()}
        <Route
          path="/settings/email/callback/:provider"
          element={
            <ProtectedRoute anyOfPermissions={SETTINGS_PERMS} tenantOnly>
              <EmailOAuthCallback />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/docs/integration" element={<IntegrationDocs />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="*" element={<Navigate to="/signup" replace />} />
    </Routes>
  );
}
