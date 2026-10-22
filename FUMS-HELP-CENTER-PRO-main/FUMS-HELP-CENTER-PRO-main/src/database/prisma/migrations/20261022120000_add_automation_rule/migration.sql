-- Workspace automation rules (auto-acknowledge, routing, escalation…).
CREATE TABLE "AutomationRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'auto_acknowledge',
    "description" TEXT,
    "assignToUserId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationRule_tenantId_idx" ON "AutomationRule"("tenantId");
CREATE INDEX "AutomationRule_isActive_idx" ON "AutomationRule"("isActive");

ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
