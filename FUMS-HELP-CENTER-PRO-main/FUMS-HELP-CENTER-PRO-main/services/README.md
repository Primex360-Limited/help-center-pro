# HelpCentre Pro microservices

Public contract stays `/api/v1/*` on the **gateway** (`:4008`).

| Service | Port | Owns |
|---------|------|------|
| gateway | 4008 | Routing, CORS, docs, mesh health |
| auth-service | 4010 | Signup, login, session, platform status |
| tenant-service | 4011 | Platform admin / tenants |
| identity-service | 4012 | Users, roles, invitations |
| tickets-service | 4013 | Tickets, support email, Socket.IO |
| notification-service | 4014 | Internal email dispatch (`x-internal-service-key`) |

Inter-service calls use `src/platform/serviceClient.js`.
Auth/identity email templates still live in-process; delivery goes to notification-service when `NOTIFICATION_SERVICE_URL` is set.

**Local:** `docker compose up --build` from the repo root.
**Render:** still runs the monolith (`node server.js`) with the same API paths.
