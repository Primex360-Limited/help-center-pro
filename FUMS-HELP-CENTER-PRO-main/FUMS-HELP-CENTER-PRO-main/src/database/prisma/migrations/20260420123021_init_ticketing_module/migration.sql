-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');   

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('message', 'internal_note');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" UUID NOT NULL,
    "ticketId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToUserId" TEXT,
    "assignedToName" TEXT,
    "assignedToEmail" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdByEmail" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "updatedByName" TEXT,
    "updatedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" UUID NOT NULL,
    "ticketRefId" UUID NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL DEFAULT 'message',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);  

--CreateTable
CREATE TABLE "TicketTag" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTag_pkey" PRIMARY KEY ("id")
);

--CreateTable
CREATE TABLE "TicketTagMap" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTagAssignment_pkey" PRIMARY KEY ("id")
);

--CreateTable
CREATE TABLE "TicketAssignmentHistory" (
    "id" UUID NOT NULL,
    "ticketRefId" UUID NOT NULL,
    "previousAssignedToUserId" TEXT,
    "previousAssignedToName" TEXT,
    "previousAssignedToEmail" TEXT,
    "newAssignedToUserId" TEXT NOT NULL,
    "newAssignedToName" TEXT NOT NULL,
    "newAssignedToEmail" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "assignedByName" TEXT NOT NULL,
    "assignedByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAssignmentHistory_pkey" PRIMARY KEY ("id")
);

--CreateTable
CREATE TABLE "TicketStatusHistory" (
    "id" UUID NOT NULL,
    "ticketRefId" UUID NOT NULL,
    "oldStatus" "TicketStatus",
    "newStatus" "TicketStatus" NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedByName" TEXT NOT NULL,
    "changedByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY ("id")
);

--CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketId_key" ON "Ticket" ("ticketId");

--CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket" ("status");

--CreateIndex
CREATE INDEX "Ticket_assignedToUserId_idx" ON "Ticket" ("assignedToUserId");

--CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket" ("createdAt");

--CreateIndex
CREATE INDEX "TicketMessage_ticketRefId_createdAt_idx" ON "TicketMessage" ("ticketRefId", "createdAt");

--CreateIndex
CREATE INDEX "TicketMessage_messageType_idx" ON "TicketMessage" ("messageType");

--CreateIndex
CREATE UNIQUE INDEX "TicketTag_name_key" ON "TicketTag" ("name");

--CreateIndex
CREATE INDEX "TicketTagMap_tagId_idx" ON "TicketTagMap" ("tagId");

--CreateIndex
CREATE UNIQUE INDEX "TicketTagMap_ticketId_tagId_key" ON "TicketTagMap" ("ticketId", "tagId");

--CreateIndex
CREATE INDEX "TicketAssignmentHistory_ticketRefId_createdAt_idx" ON "TicketAssignmentHistory" ("ticketRefId", "createdAt");

--CreateIndex
CREATE INDEX "TicketStatusHistory_ticketRefId_createdAt_idx" ON "TicketStatusHistory" ("ticketRefId", "createdAt");

--AddForeignKey
ALTER TABLE "TicketMessage"
ADD CONSTRAINT "TicketMessage_ticketRefId_fkey" FOREIGN KEY ("ticketRefId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

--AddForeignKey
ALTER TABLE "TicketTagMap"
ADD CONSTRAINT "TicketTagMap_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

--AddForeignKey
ALTER TABLE "TicketTagMap"
ADD CONSTRAINT "TicketTagMap_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "TicketTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

--AddForeignKey
ALTER TABLE "TicketAssignmentHistory"
ADD CONSTRAINT "TicketAssignmentHistory_ticketRefId_fkey" FOREIGN KEY ("ticketRefId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

--AddForeignKey
ALTER TABLE "TicketStatusHistory"
ADD CONSTRAINT "TicketStatusHistory_ticketRefId_fkey" FOREIGN KEY ("ticketRefId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
