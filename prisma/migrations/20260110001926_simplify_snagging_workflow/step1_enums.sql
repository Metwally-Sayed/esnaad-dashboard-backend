-- Step 1: Add enum values first (must be in separate transaction)

-- AlterEnum: Add new SnaggingStatus values
ALTER TYPE "SnaggingStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "SnaggingStatus" ADD VALUE IF NOT EXISTS 'SENT_TO_OWNER';
ALTER TYPE "SnaggingStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "SnaggingStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterEnum: Add new AuditAction values
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SNAGGING_SENT_TO_OWNER';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SNAGGING_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SNAGGING_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SNAGGING_APPOINTMENT_SET';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SNAGGING_PDF_GENERATED';

-- CreateEnum: SnaggingSeverity
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SnaggingSeverity') THEN
        CREATE TYPE "SnaggingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    END IF;
END$$;
