-- Monthly confirm lock for 课时记录: after ops holds confirm for 3s, that month's
-- lesson records are frozen for everyone except 张捷嘉 (department head).
CREATE TABLE IF NOT EXISTS "lesson_month_locks" (
  "month" text PRIMARY KEY NOT NULL,
  "confirmed_by" text NOT NULL,
  "confirmed_by_name" text NOT NULL,
  "confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
