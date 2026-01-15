-- AddHandoverAcceptedStatus
-- Add new ACCEPTED status to HandoverStatus enum
ALTER TYPE "HandoverStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';

-- AddHandoverAcceptedAuditAction
-- Add new HANDOVER_ACCEPTED to AuditAction enum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HANDOVER_ACCEPTED';

-- AddHandoverNewFields
-- Add new fields for simplified flow
ALTER TABLE "handovers" ADD COLUMN IF NOT EXISTS "ownerAcceptedAt" TIMESTAMP(3);
ALTER TABLE "handovers" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;
ALTER TABLE "handovers" ADD COLUMN IF NOT EXISTS "pdfPublicId" TEXT;
ALTER TABLE "handovers" ADD COLUMN IF NOT EXISTS "adminSignature" TEXT;
ALTER TABLE "handovers" ADD COLUMN IF NOT EXISTS "ownerSignature" TEXT;

-- HandleDuplicateHandovers
-- Before adding unique constraint, we need to handle duplicate unitIds
-- Keep only the most recent handover for each unit (by createdAt DESC)
-- Mark older ones as CANCELLED
WITH RankedHandovers AS (
  SELECT 
    id,
    "unitId",
    ROW_NUMBER() OVER (PARTITION BY "unitId" ORDER BY "createdAt" DESC) as rn
  FROM "handovers"
  WHERE status NOT IN ('CANCELLED')
)
UPDATE "handovers" h
SET 
  status = 'CANCELLED',
  "cancelledAt" = NOW(),
  "internalNotes" = COALESCE("internalNotes", '') || E'\n\nAuto-cancelled during migration: duplicate handover for unit'
FROM RankedHandovers rh
WHERE h.id = rh.id AND rh.rn > 1;

-- AddUniqueConstraintToHandoverUnitId
-- Now safe to add unique constraint (cancelled handovers still violate, so we need different approach)
-- Instead, create a unique partial index that only applies to non-cancelled handovers
CREATE UNIQUE INDEX IF NOT EXISTS "handovers_unitId_active_unique" 
ON "handovers"("unitId") 
WHERE status != 'CANCELLED';

-- Note: We cannot add @unique to the Prisma schema directly because cancelled handovers
-- would still violate it. The partial index ensures only one active handover per unit.
