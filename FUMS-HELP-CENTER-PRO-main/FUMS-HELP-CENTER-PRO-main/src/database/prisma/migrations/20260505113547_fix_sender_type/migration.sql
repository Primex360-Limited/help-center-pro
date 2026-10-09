-- CreateEnum
CREATE TYPE "TicketEventType" AS ENUM ('EMAIL', 'CHAT', 'CALL', 'LOG');

-- CreateEnum
CREATE TYPE "TicketChannel" AS ENUM ('EMAIL', 'CHAT', 'PHONE');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('AGENT', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "CallEventType" AS ENUM ('CALL_INITIATED', 'CALL_RECEIVED', 'CALL_PICKED', 'CALL_HANGUP');

-- CreateEnum
CREATE TYPE "CallActor" AS ENUM ('AGENT', 'CUSTOMER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT;

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "type" "TicketEventType" NOT NULL,
    "channel" "TicketChannel" NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEmailMessage" (
    "id" UUID NOT NULL,
    "ticketEventId" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,

    CONSTRAINT "TicketEmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketChatMessage" (
    "id" UUID NOT NULL,
    "ticketEventId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "senderType" "SenderType" NOT NULL,

    CONSTRAINT "TicketChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCall" (
    "id" UUID NOT NULL,
    "ticketEventId" UUID NOT NULL,
    "duration" INTEGER,
    "recordingUrl" TEXT,

    CONSTRAINT "TicketCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCallLog" (
    "id" UUID NOT NULL,
    "callId" UUID NOT NULL,
    "eventType" "CallEventType" NOT NULL,
    "actor" "CallActor" NOT NULL,
    "direction" "CallDirection",
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketEvent_ticketId_createdAt_idx" ON "TicketEvent"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketEmailMessage_ticketEventId_key" ON "TicketEmailMessage"("ticketEventId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketChatMessage_ticketEventId_key" ON "TicketChatMessage"("ticketEventId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketCall_ticketEventId_key" ON "TicketCall"("ticketEventId");

-- CreateIndex
CREATE INDEX "TicketCallLog_callId_timestamp_idx" ON "TicketCallLog"("callId", "timestamp");

-- CreateIndex
CREATE INDEX "Ticket_customerId_idx" ON "Ticket"("customerId");

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEmailMessage" ADD CONSTRAINT "TicketEmailMessage_ticketEventId_fkey" FOREIGN KEY ("ticketEventId") REFERENCES "TicketEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketChatMessage" ADD CONSTRAINT "TicketChatMessage_ticketEventId_fkey" FOREIGN KEY ("ticketEventId") REFERENCES "TicketEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCall" ADD CONSTRAINT "TicketCall_ticketEventId_fkey" FOREIGN KEY ("ticketEventId") REFERENCES "TicketEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCallLog" ADD CONSTRAINT "TicketCallLog_callId_fkey" FOREIGN KEY ("callId") REFERENCES "TicketCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
