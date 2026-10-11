-- 课时记录: 学生人数 → 应到人数 (expected_count) + 实到人数 (actual_count).
ALTER TABLE "lesson_records" ADD COLUMN IF NOT EXISTS "expected_count" integer;--> statement-breakpoint
ALTER TABLE "lesson_records" ADD COLUMN IF NOT EXISTS "actual_count" integer;--> statement-breakpoint
-- Existing head counts were the students actually present.
-- The legacy nullable "students" column is kept (no longer written) so a rollback to the previous build still reads its data.
UPDATE "lesson_records" SET "actual_count" = "students" WHERE "actual_count" IS NULL AND "students" IS NOT NULL;
