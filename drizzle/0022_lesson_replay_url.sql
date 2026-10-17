-- 课时记录: 课程回放链接, copied with the 课程反馈 into the parent group.
ALTER TABLE "lesson_records" ADD COLUMN IF NOT EXISTS "replay_url" text DEFAULT '' NOT NULL;
