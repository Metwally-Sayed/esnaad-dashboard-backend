-- CreateEnum: ServiceChargePeriodType
CREATE TYPE "ServiceChargePeriodType" AS ENUM ('YEARLY', 'QUARTERLY');

-- AlterEnum: Add new AuditAction values for service charge
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SERVICE_CHARGE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SERVICE_CHARGE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SERVICE_CHARGE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'UNIT_SERVICE_CHARGE_OVERRIDDEN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SERVICE_CHARGE_STATEMENT_GENERATED';

-- AlterTable: units - Add price field
ALTER TABLE "units" ADD COLUMN "price" DECIMAL(12,2);

-- CreateTable: project_service_charges
CREATE TABLE "project_service_charges" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER,
    "periodType" "ServiceChargePeriodType" NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "project_service_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable: unit_service_charges
CREATE TABLE "unit_service_charges" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "projectServiceChargeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "overriddenAmount" DECIMAL(12,2),
    "overriddenById" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_service_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_service_charges_projectId_year_quarter_key" ON "project_service_charges"("projectId", "year", "quarter");

-- CreateIndex
CREATE INDEX "project_service_charges_projectId_idx" ON "project_service_charges"("projectId");

-- CreateIndex
CREATE INDEX "project_service_charges_year_idx" ON "project_service_charges"("year");

-- CreateIndex
CREATE UNIQUE INDEX "unit_service_charges_unitId_projectServiceChargeId_key" ON "unit_service_charges"("unitId", "projectServiceChargeId");

-- CreateIndex
CREATE INDEX "unit_service_charges_unitId_idx" ON "unit_service_charges"("unitId");

-- CreateIndex
CREATE INDEX "unit_service_charges_projectServiceChargeId_idx" ON "unit_service_charges"("projectServiceChargeId");

-- AddForeignKey
ALTER TABLE "project_service_charges" ADD CONSTRAINT "project_service_charges_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_service_charges" ADD CONSTRAINT "project_service_charges_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_service_charges" ADD CONSTRAINT "unit_service_charges_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_service_charges" ADD CONSTRAINT "unit_service_charges_projectServiceChargeId_fkey" FOREIGN KEY ("projectServiceChargeId") REFERENCES "project_service_charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_service_charges" ADD CONSTRAINT "unit_service_charges_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
