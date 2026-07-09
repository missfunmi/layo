-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('active', 'stale');

-- DropIndex
DROP INDEX "check_ins_user_id_check_in_date_key";

-- DropIndex
DROP INDEX "check_ins_user_id_idx";

-- AlterTable
ALTER TABLE "check_ins" ADD COLUMN     "status" "RecordStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN     "status" "RecordStatus" NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX "check_ins_user_id_check_in_date_idx" ON "check_ins"("user_id", "check_in_date");

-- CreateIndex
-- Partial unique index: at most one active check-in per user per day. Stale
-- rows from prior delete-and-redo cycles are excluded so history can accumulate.
CREATE UNIQUE INDEX "check_ins_user_id_check_in_date_active_key" ON "check_ins"("user_id", "check_in_date") WHERE "status" = 'active';
