-- Add queue and waiting states to the existing ticket status enum.
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_REPLY';

-- Store chat visitor identity, queue timestamps, and SLA/waiting metadata.
ALTER TABLE "Ticket"
ADD COLUMN "customerIp" TEXT,
ADD COLUMN "queuedAt" TIMESTAMP(3),
ADD COLUMN "pickedAt" TIMESTAMP(3),
ADD COLUMN "resolutionDueAt" TIMESTAMP(3),
ADD COLUMN "waitingForCustomerAt" TIMESTAMP(3),
ADD COLUMN "lastCustomerResponseAt" TIMESTAMP(3),
ADD COLUMN "lastAgentResponseAt" TIMESTAMP(3);

-- Capture agent transfer notes without changing the existing assignment history flow.
ALTER TABLE "TicketAssignmentHistory"
ADD COLUMN "transferReason" TEXT;

CREATE INDEX "Ticket_customerIp_idx" ON "Ticket" ("customerIp");
CREATE INDEX "Ticket_resolutionDueAt_idx" ON "Ticket" ("resolutionDueAt");
