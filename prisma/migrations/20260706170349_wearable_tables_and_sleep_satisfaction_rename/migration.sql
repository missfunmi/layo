-- CreateEnum
CREATE TYPE "WearableProvider" AS ENUM ('oura');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('active', 'inactive');

-- RenameColumn (preserves existing data)
ALTER TABLE "check_ins" RENAME COLUMN "sleep_score" TO "sleep_satisfaction";

-- CreateTable
CREATE TABLE "wearable_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "WearableProvider" NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'active',
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wearable_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wearable_daily_metrics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "provider" "WearableProvider" NOT NULL,
    "metric_date" DATE NOT NULL,
    "readiness_score" INTEGER,
    "hrv_avg" DOUBLE PRECISION,
    "resting_heart_rate" INTEGER,
    "sleep_score" INTEGER,
    "sleep_duration_minutes" INTEGER,
    "deep_sleep_minutes" INTEGER,
    "rem_sleep_minutes" INTEGER,
    "sleep_efficiency" DOUBLE PRECISION,
    "body_temp_deviation" DOUBLE PRECISION,
    "raw_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wearable_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wearable_connections_user_id_provider_key" ON "wearable_connections"("user_id", "provider");

-- CreateIndex
CREATE INDEX "wearable_daily_metrics_user_id_provider_idx" ON "wearable_daily_metrics"("user_id", "provider");

-- CreateIndex
CREATE INDEX "wearable_daily_metrics_user_id_metric_date_idx" ON "wearable_daily_metrics"("user_id", "metric_date");

-- CreateIndex
CREATE UNIQUE INDEX "wearable_daily_metrics_user_id_provider_metric_date_key" ON "wearable_daily_metrics"("user_id", "provider", "metric_date");

-- AddForeignKey
ALTER TABLE "wearable_connections" ADD CONSTRAINT "wearable_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wearable_daily_metrics" ADD CONSTRAINT "wearable_daily_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wearable_daily_metrics" ADD CONSTRAINT "wearable_daily_metrics_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "wearable_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
