-- CreateEnum
CREATE TYPE "TrainingGoal" AS ENUM ('race', 'non_race');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('running', 'cycling', 'swimming', 'triathlon', 'skiing', 'other');

-- CreateEnum
CREATE TYPE "YesterdayWorkoutType" AS ENUM ('planned', 'suggested', 'other');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('as_written', 'modify', 'rest');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birth_year" INTEGER NOT NULL,
    "hormonal_life_stage" TEXT[],
    "training_goal" "TrainingGoal" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "event_type_other" TEXT,
    "event_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "check_in_date" DATE NOT NULL,
    "yesterday_workout_type" "YesterdayWorkoutType",
    "yesterday_workout_description" TEXT,
    "yesterday_workout_feedback" TEXT,
    "todays_planned_workout" TEXT NOT NULL,
    "sleep_score" INTEGER NOT NULL,
    "feel_score" INTEGER NOT NULL,
    "period_started_today" BOOLEAN,
    "cycle_day" INTEGER,
    "stressors" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "check_in_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "recommendation_type" "RecommendationType" NOT NULL,
    "modification_detail" TEXT,
    "rationale" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_configs" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "max_tokens" INTEGER NOT NULL,
    "additional_params" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_inference_logs" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "raw_response" TEXT NOT NULL,
    "rationale_internal" TEXT NOT NULL,
    "readiness_score" INTEGER NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_inference_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_device_id_key" ON "users"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "events_user_id_idx" ON "events"("user_id");

-- CreateIndex
CREATE INDEX "check_ins_user_id_idx" ON "check_ins"("user_id");

-- CreateIndex
CREATE INDEX "check_ins_check_in_date_idx" ON "check_ins"("check_in_date");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_user_id_check_in_date_key" ON "check_ins"("user_id", "check_in_date");

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_check_in_id_key" ON "recommendations"("check_in_id");

-- CreateIndex
CREATE INDEX "recommendations_user_id_idx" ON "recommendations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_configs_version_key" ON "prompt_configs"("version");

-- CreateIndex
CREATE UNIQUE INDEX "llm_inference_logs_recommendation_id_key" ON "llm_inference_logs"("recommendation_id");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "check_ins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_inference_logs" ADD CONSTRAINT "llm_inference_logs_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
