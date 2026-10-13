ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "title" text;
--> statement-breakpoint
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "content" text;
--> statement-breakpoint
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "handouts" text;
--> statement-breakpoint
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "homework" text;
--> statement-breakpoint
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "slides" text;
--> statement-breakpoint
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "reference_materials" text;
