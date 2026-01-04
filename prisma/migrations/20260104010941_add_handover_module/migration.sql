-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('DRAFT', 'SENT_TO_OWNER', 'OWNER_CONFIRMED', 'CHANGES_REQUESTED', 'ADMIN_CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HandoverItemStatus" AS ENUM ('OK', 'NOT_OK', 'NA');

-- CreateEnum
CREATE TYPE "DocumentModule" AS ENUM ('HANDOVER', 'UNIT_PROFILE', 'SNAGGING', 'PROJECT');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PDF', 'DOCX', 'XLSX');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'HANDOVER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'HANDOVER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'HANDOVER_SENT_TO_OWNER';
ALTER TYPE "AuditAction" ADD VALUE 'HANDOVER_OWNER_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'HANDOVER_CHANGES_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'HANDOVER_ADMIN_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'HANDOVER_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'HANDOVER_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'HANDOVER_PDF_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'HANDOVER_MESSAGE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_CREATED';

-- CreateTable
CREATE TABLE "handovers" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdByAdminId" TEXT NOT NULL,
    "status" "HandoverStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "scheduledAt" TIMESTAMP(3),
    "handoverAt" TIMESTAMP(3),
    "ownerConfirmedAt" TIMESTAMP(3),
    "adminConfirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "internalNotes" TEXT,
    "snapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_items" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expectedValue" TEXT,
    "actualValue" TEXT,
    "status" "HandoverItemStatus" NOT NULL DEFAULT 'NA',
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handover_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_attachments" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "itemId" TEXT,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handover_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_messages" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "handover_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "module" "DocumentModule" NOT NULL,
    "entityId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "handovers_unitId_createdAt_idx" ON "handovers"("unitId", "createdAt");

-- CreateIndex
CREATE INDEX "handovers_ownerId_createdAt_idx" ON "handovers"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "handovers_status_createdAt_idx" ON "handovers"("status", "createdAt");

-- CreateIndex
CREATE INDEX "handovers_createdByAdminId_idx" ON "handovers"("createdByAdminId");

-- CreateIndex
CREATE INDEX "handover_items_handoverId_sortOrder_idx" ON "handover_items"("handoverId", "sortOrder");

-- CreateIndex
CREATE INDEX "handover_attachments_handoverId_idx" ON "handover_attachments"("handoverId");

-- CreateIndex
CREATE INDEX "handover_attachments_itemId_idx" ON "handover_attachments"("itemId");

-- CreateIndex
CREATE INDEX "handover_messages_handoverId_createdAt_idx" ON "handover_messages"("handoverId", "createdAt");

-- CreateIndex
CREATE INDEX "handover_messages_authorUserId_idx" ON "handover_messages"("authorUserId");

-- CreateIndex
CREATE INDEX "handover_messages_deletedAt_idx" ON "handover_messages"("deletedAt");

-- CreateIndex
CREATE INDEX "documents_module_entityId_createdAt_idx" ON "documents"("module", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "documents_createdByUserId_idx" ON "documents"("createdByUserId");

-- CreateIndex
CREATE INDEX "documents_templateKey_idx" ON "documents"("templateKey");

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "handovers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_attachments" ADD CONSTRAINT "handover_attachments_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "handovers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_attachments" ADD CONSTRAINT "handover_attachments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "handover_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_messages" ADD CONSTRAINT "handover_messages_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "handovers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_messages" ADD CONSTRAINT "handover_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "handovers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
