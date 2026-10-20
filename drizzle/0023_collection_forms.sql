-- 收集表单: forms, questions, submissions (answers carry a label snapshot keyed by question id).
CREATE TABLE IF NOT EXISTS "forms" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "title_en" text DEFAULT '' NOT NULL,
  "intro" text DEFAULT '' NOT NULL,
  "intro_en" text DEFAULT '' NOT NULL,
  "open" boolean DEFAULT true NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "forms_slug_idx" ON "forms" ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_questions" (
  "id" text PRIMARY KEY NOT NULL,
  "form_id" text NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "type" text NOT NULL,
  "label_zh" text NOT NULL,
  "label_en" text DEFAULT '' NOT NULL,
  "help_zh" text DEFAULT '' NOT NULL,
  "help_en" text DEFAULT '' NOT NULL,
  "placeholder" text DEFAULT '' NOT NULL,
  "required" boolean DEFAULT false NOT NULL,
  "options" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "require_all" boolean DEFAULT false NOT NULL,
  "map_to" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_questions_form_idx" ON "form_questions" ("form_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_submissions" (
  "id" text PRIMARY KEY NOT NULL,
  "form_id" text NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "form_version" integer DEFAULT 1 NOT NULL,
  "answers" jsonb NOT NULL,
  "name" text DEFAULT '' NOT NULL,
  "phone" text DEFAULT '' NOT NULL,
  "status" text DEFAULT '待分配' NOT NULL,
  "program" text,
  "team" text,
  "student_id" text,
  "assigned_by" text,
  "assigned_at" timestamp with time zone,
  "note" text DEFAULT '' NOT NULL,
  "ip" text DEFAULT '' NOT NULL,
  "user_agent" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_submissions_form_idx" ON "form_submissions" ("form_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_submissions_status_idx" ON "form_submissions" ("status");
