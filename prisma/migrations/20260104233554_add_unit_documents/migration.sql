-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('CONTRACT', 'BILL', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'UNIT_DOCUMENT_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'UNIT_DOCUMENT_DELETED';

-- CreateTable
CREATE TABLE "unit_documents" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "unit_documents_unitId_createdAt_idx" ON "unit_documents"("unitId", "createdAt");

-- CreateIndex
CREATE INDEX "unit_documents_category_idx" ON "unit_documents"("category");

-- CreateIndex
CREATE INDEX "unit_documents_uploadedByUserId_idx" ON "unit_documents"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "unit_documents" ADD CONSTRAINT "unit_documents_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_documents" ADD CONSTRAINT "unit_documents_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
