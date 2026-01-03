/*
  Warnings:

  - You are about to drop the column `status` on the `units` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "units_status_idx";

-- AlterTable
ALTER TABLE "units" DROP COLUMN "status",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "amenities" TEXT,
ADD COLUMN     "unitType" TEXT;
