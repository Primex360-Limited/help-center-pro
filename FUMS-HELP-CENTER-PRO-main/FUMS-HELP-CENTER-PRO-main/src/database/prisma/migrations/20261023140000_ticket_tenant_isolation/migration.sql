-- Tenant isolation for tickets: every ticket belongs to exactly one workspace.
-- Backfill from creator / assignee, purge demo + unscoped rows, then enforce NOT NULL.

ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "tenantId" UUID;

-- Prefer creator's workspace.
UPDATE "Ticket" AS t
SET "tenantId" = u."tenantId"
FROM "User" AS u
WHERE t."tenantId" IS NULL
  AND t."createdByUserId" = u."id"::text
  AND u."tenantId" IS NOT NULL;

-- Fall back to assignee's workspace.
UPDATE "Ticket" AS t
SET "tenantId" = u."tenantId"
FROM "User" AS u
WHERE t."tenantId" IS NULL
  AND t."assignedToUserId" IS NOT NULL
  AND t."assignedToUserId" = u."id"::text
  AND u."tenantId" IS NOT NULL;

-- Remove known demo / seed tickets and any remaining unscoped rows (fail closed).
DELETE FROM "Ticket"
WHERE "ticketId" LIKE 'TK-000%'
   OR "ticketId" LIKE 'TCKT-20260512-%'
   OR "tenantId" IS NULL;

ALTER TABLE "Ticket" ALTER COLUMN "tenantId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Ticket_tenantId_fkey'
  ) THEN
    ALTER TABLE "Ticket"
      ADD CONSTRAINT "Ticket_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Ticket_tenantId_idx" ON "Ticket"("tenantId");
CREATE INDEX IF NOT EXISTS "Ticket_tenantId_status_idx" ON "Ticket"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Ticket_tenantId_createdAt_idx" ON "Ticket"("tenantId", "createdAt");
