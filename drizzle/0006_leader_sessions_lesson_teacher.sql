CREATE TABLE "course_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"location" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "lesson_records" ADD COLUMN "teacher" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "leader" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "course_sessions_course_idx" ON "course_sessions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_sessions_date_idx" ON "course_sessions" USING btree ("date");--> statement-breakpoint
-- 部门负责人: only 张捷嘉 (explicit flag; superadmin alone no longer sees others' 课时/津贴/绩效).
UPDATE "users" SET "leader" = true WHERE "email" = 'zhangjiejia@nexus.local';
