-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Ticket"
ADD COLUMN "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM';

-- CreateIndex
CREATE INDEX "Ticket_priority_idx" ON "Ticket" ("priority");

-- DropForeignKey
ALTER TABLE "TicketTagMap"
DROP CONSTRAINT "TicketTagMap_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "TicketTagMap"
DROP CONSTRAINT "TicketTagMap_tagId_fkey";

-- DropTable
DROP TABLE "TicketTagMap";

-- DropTable
DROP TABLE "TicketTag";
