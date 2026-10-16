# HelpCentre Pro services (optional / legacy)

The app runs as a **monolith** by default:

- Local: `node server.js` / `docker compose up` → `backend` on `:4008`
- Render: `helpcentre-pro-api` → `npx prisma migrate deploy && node server.js`

Public API contract stays `/api/v1/*`.

The folders under `services/` are a leftover split (gateway + domain processes).
They are not started by the default compose or Render blueprint.
