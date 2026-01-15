-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('GUEST_VISIT', 'WORK_PERMISSION');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpiresMode" AS ENUM ('DATE', 'USES', 'UNLIMITED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'REQUEST_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'REQUEST_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'REQUEST_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'REQUEST_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'REQUEST_REVOKED';

-- AlterEnum
ALTER TYPE "DocumentModule" ADD VALUE 'REQUEST';

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "purpose" TEXT,
    "visitorName" TEXT,
    "visitorPhone" TEXT,
    "companyName" TEXT,
    "representativeName" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "expiresMode" "ExpiresMode",
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER DEFAULT 0,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "approvedByAdminId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByAdminId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "pdfUrl" TEXT,
    "pdfPublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requests_ownerId_createdAt_idx" ON "requests"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "requests_unitId_createdAt_idx" ON "requests"("unitId", "createdAt");

-- CreateIndex
CREATE INDEX "requests_status_idx" ON "requests"("status");

-- CreateIndex
CREATE INDEX "requests_type_idx" ON "requests"("type");

-- CreateIndex
CREATE INDEX "requests_deletedAt_idx" ON "requests"("deletedAt");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_approvedByAdminId_fkey" FOREIGN KEY ("approvedByAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_rejectedByAdminId_fkey" FOREIGN KEY ("rejectedByAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
