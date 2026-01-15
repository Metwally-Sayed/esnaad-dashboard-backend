-- Migration: Snagging v2 Simplification
-- This migration:
-- 1. Adds new columns to Snagging (ownerId, createdByAdminId, signatures, pdf fields)
-- 2. Creates SnaggingImage table
-- 3. Migrates existing data (populates ownerId from unit.ownerId, createdByAdminId from createdByUserId)
-- 4. Removes old columns (status, priority, createdByUserId)
-- 5. Drops old tables (SnaggingMessage, SnaggingAttachment)

-- Step 1: Add new columns (nullable first for data migration)
ALTER TABLE "snaggings" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "snaggings" ADD COLUMN "createdByAdminId" TEXT;
ALTER TABLE "snaggings" ADD COLUMN "adminSignatureUrl" TEXT;
ALTER TABLE "snaggings" ADD COLUMN "ownerSignatureUrl" TEXT;
ALTER TABLE "snaggings" ADD COLUMN "pdfUrl" TEXT;
ALTER TABLE "snaggings" ADD COLUMN "pdfPublicId" TEXT;

-- Step 2: Create SnaggingImage table
CREATE TABLE "snagging_images" (
    "id" TEXT NOT NULL,
    "snaggingId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "comment" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snagging_images_pkey" PRIMARY KEY ("id")
);

-- Step 3: Data migration - populate ownerId and createdByAdminId from existing data
UPDATE "snaggings" s
SET 
    "ownerId" = u."ownerId",
    "createdByAdminId" = s."createdByUserId"
FROM "units" u
WHERE s."unitId" = u."id" AND u."ownerId" IS NOT NULL;

-- For snaggings where unit has no owner, set ownerId to createdByUserId (fallback)
UPDATE "snaggings" s
SET "ownerId" = s."createdByUserId"
WHERE "ownerId" IS NULL;

-- Step 4: Make new columns required (after data migration)
ALTER TABLE "snaggings" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "snaggings" ALTER COLUMN "createdByAdminId" SET NOT NULL;

-- Step 5: Add foreign key constraints
ALTER TABLE "snaggings" ADD CONSTRAINT "snaggings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "snaggings" ADD CONSTRAINT "snaggings_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "snagging_images" ADD CONSTRAINT "snagging_images_snaggingId_fkey" FOREIGN KEY ("snaggingId") REFERENCES "snaggings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 6: Add indexes
CREATE INDEX "snaggings_ownerId_createdAt_idx" ON "snaggings"("ownerId", "createdAt");
CREATE INDEX "snagging_images_snaggingId_sortOrder_idx" ON "snagging_images"("snaggingId", "sortOrder");

-- Step 7: Remove old indexes that reference removed columns
DROP INDEX IF EXISTS "snaggings_status_priority_idx";

-- Step 8: Remove old columns
ALTER TABLE "snaggings" DROP COLUMN "createdByUserId";
ALTER TABLE "snaggings" DROP COLUMN "status";
ALTER TABLE "snaggings" DROP COLUMN "priority";

-- Step 9: Drop old tables (SnaggingAttachment first due to FK, then SnaggingMessage)
DROP TABLE IF EXISTS "snagging_attachments";
DROP TABLE IF EXISTS "snagging_messages";
