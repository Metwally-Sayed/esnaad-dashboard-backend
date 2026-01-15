-- Step 2: Create new tables and migrate data

-- CreateTable: snagging_items
CREATE TABLE IF NOT EXISTS "snagging_items" (
    "id" TEXT NOT NULL,
    "snaggingId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "severity" "SnaggingSeverity" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snagging_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: snagging_item_images
CREATE TABLE IF NOT EXISTS "snagging_item_images" (
    "id" TEXT NOT NULL,
    "snaggingItemId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snagging_item_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'snagging_items_snaggingId_fkey'
    ) THEN
        ALTER TABLE "snagging_items" ADD CONSTRAINT "snagging_items_snaggingId_fkey"
        FOREIGN KEY ("snaggingId") REFERENCES "snaggings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'snagging_item_images_snaggingItemId_fkey'
    ) THEN
        ALTER TABLE "snagging_item_images" ADD CONSTRAINT "snagging_item_images_snaggingItemId_fkey"
        FOREIGN KEY ("snaggingItemId") REFERENCES "snagging_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "snagging_items_snaggingId_sortOrder_idx" ON "snagging_items"("snaggingId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "snagging_item_images_snaggingItemId_sortOrder_idx" ON "snagging_item_images"("snaggingItemId", "sortOrder");

-- Migrate existing snagging_images to new structure
-- For each snagging with images, create a default SnaggingItem with category "General"
INSERT INTO "snagging_items" ("id", "snaggingId", "category", "label", "location", "severity", "sortOrder", "createdAt")
SELECT
    gen_random_uuid()::text,
    s.id,
    'General',
    s.title,
    'Various',
    'MEDIUM'::"SnaggingSeverity",
    0,
    s."createdAt"
FROM "snaggings" s
WHERE EXISTS (
    SELECT 1 FROM "snagging_images" si WHERE si."snaggingId" = s.id
)
AND NOT EXISTS (
    SELECT 1 FROM "snagging_items" si_new WHERE si_new."snaggingId" = s.id
);

-- Migrate existing images to snagging_item_images
INSERT INTO "snagging_item_images" ("id", "snaggingItemId", "imageUrl", "publicId", "caption", "sortOrder", "createdAt")
SELECT
    gen_random_uuid()::text,
    si_new.id,
    si_old."imageUrl",
    COALESCE(si_old."imageUrl", ''),
    si_old.comment,
    si_old."sortOrder",
    si_old."createdAt"
FROM "snagging_images" si_old
JOIN "snagging_items" si_new ON si_new."snaggingId" = si_old."snaggingId"
WHERE si_new.category = 'General'
AND NOT EXISTS (
    SELECT 1 FROM "snagging_item_images" sii WHERE sii."snaggingItemId" = si_new.id
);

-- AlterTable: snaggings - Add new columns
ALTER TABLE "snaggings" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "snaggings" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "snaggings" ADD COLUMN IF NOT EXISTS "scheduledNote" TEXT;
ALTER TABLE "snaggings" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);

-- Add status column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'snaggings' AND column_name = 'status') THEN
        ALTER TABLE "snaggings" ADD COLUMN "status" "SnaggingStatus" NOT NULL DEFAULT 'DRAFT';
    END IF;
END$$;

-- Drop old columns from snaggings
ALTER TABLE "snaggings" DROP COLUMN IF EXISTS "adminSignatureUrl";
ALTER TABLE "snaggings" DROP COLUMN IF EXISTS "ownerSignatureUrl";
ALTER TABLE "snaggings" DROP COLUMN IF EXISTS "deletedAt";

-- Drop old snagging_images table
DROP TABLE IF EXISTS "snagging_images" CASCADE;

-- CreateIndex on status
CREATE INDEX IF NOT EXISTS "snaggings_status_idx" ON "snaggings"("status");
