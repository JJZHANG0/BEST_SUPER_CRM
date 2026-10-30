-- A month lock belongs to one 教务老师. Older rows locked the whole month; keep them as that confirmer's own lock only.
ALTER TABLE "lesson_month_locks" ADD COLUMN IF NOT EXISTS "ops_teacher" text;
UPDATE "lesson_month_locks" SET "ops_teacher" = lower("confirmed_by") WHERE "ops_teacher" IS NULL OR "ops_teacher" = '';
ALTER TABLE "lesson_month_locks" DROP CONSTRAINT IF EXISTS "lesson_month_locks_pkey";
ALTER TABLE "lesson_month_locks" ALTER COLUMN "ops_teacher" SET NOT NULL;
ALTER TABLE "lesson_month_locks" ADD CONSTRAINT "lesson_month_locks_pkey" PRIMARY KEY ("month", "ops_teacher");
