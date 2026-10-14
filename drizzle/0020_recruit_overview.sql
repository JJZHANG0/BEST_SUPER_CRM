-- 「2026 BEST 项目招生总览」: project-level 招生目标 / 已招生人数 and per-team 招募 facts + poster / 课程计划 images.
ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "recruit_target" integer;
--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "recruit_enrolled" integer;
--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "recruit_source" text;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "recruit_status" text;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "recruit_capacity" integer;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "recruit_enrolled" integer;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "recruit_remaining" integer;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "poster_url" text;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "schedule_url" text;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "sheet_ref" text;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "ops_owner" text;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "archived" boolean DEFAULT false;
