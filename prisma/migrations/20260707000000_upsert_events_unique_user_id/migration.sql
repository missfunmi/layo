-- DropIndex
DROP INDEX "events_user_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "events_user_id_key" ON "events"("user_id");
