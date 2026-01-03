-- CreateEnum
CREATE TYPE "SnaggingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SnaggingPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'SNAGGING_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'SNAGGING_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SNAGGING_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'SNAGGING_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'SNAGGING_MESSAGE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'SNAGGING_MESSAGE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SNAGGING_MESSAGE_DELETED';

-- CreateTable
CREATE TABLE "snaggings" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SnaggingStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SnaggingPriority" NOT NULL DEFAULT 'MEDIUM',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snaggings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snagging_messages" (
    "id" TEXT NOT NULL,
    "snaggingId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "bodyTitle" TEXT,
    "bodyText" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snagging_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snagging_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snagging_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "snaggings_unitId_createdAt_idx" ON "snaggings"("unitId", "createdAt");

-- CreateIndex
CREATE INDEX "snaggings_createdByUserId_createdAt_idx" ON "snaggings"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "snaggings_status_priority_idx" ON "snaggings"("status", "priority");

-- CreateIndex
CREATE INDEX "snaggings_deletedAt_idx" ON "snaggings"("deletedAt");

-- CreateIndex
CREATE INDEX "snagging_messages_snaggingId_createdAt_idx" ON "snagging_messages"("snaggingId", "createdAt");

-- CreateIndex
CREATE INDEX "snagging_messages_authorUserId_idx" ON "snagging_messages"("authorUserId");

-- CreateIndex
CREATE INDEX "snagging_messages_deletedAt_idx" ON "snagging_messages"("deletedAt");

-- CreateIndex
CREATE INDEX "snagging_attachments_messageId_idx" ON "snagging_attachments"("messageId");

-- AddForeignKey
ALTER TABLE "snaggings" ADD CONSTRAINT "snaggings_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snaggings" ADD CONSTRAINT "snaggings_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snagging_messages" ADD CONSTRAINT "snagging_messages_snaggingId_fkey" FOREIGN KEY ("snaggingId") REFERENCES "snaggings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snagging_messages" ADD CONSTRAINT "snagging_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snagging_attachments" ADD CONSTRAINT "snagging_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "snagging_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
