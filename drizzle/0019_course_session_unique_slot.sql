-- One 排课 meeting per (course, date, start). Editing a course used to regenerate its sessions with new ids
-- while the old rows were never deleted, leaving every meeting twice. Drop leftover duplicates first
-- (keep the row with lesson content, else the oldest), then enforce the slot as unique.
DELETE FROM "course_sessions" d USING (
  SELECT "id", row_number() OVER (
    PARTITION BY "course_id", "date", "start_time"
    ORDER BY (COALESCE("title",'') || COALESCE("content",'') || COALESCE("handouts",'') || COALESCE("homework",'') || COALESCE("slides",'') || COALESCE("reference_materials",'') <> '') DESC, "created_at" ASC, "id" ASC
  ) AS rn FROM "course_sessions"
) r WHERE d."id" = r."id" AND r.rn > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_sessions_course_slot_uq" ON "course_sessions" USING btree ("course_id","date","start_time");
