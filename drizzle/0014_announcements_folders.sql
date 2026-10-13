ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "folder" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_folders" (
  "id" text PRIMARY KEY NOT NULL,
  "program" text NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_folders_program_idx" ON "resource_folders" USING btree ("program");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "resource_folders" ADD CONSTRAINT "resource_folders_program_programs_id_fk" FOREIGN KEY ("program") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "announcements" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "tag" text DEFAULT '公告' NOT NULL,
  "program" text,
  "audience" text DEFAULT 'all' NOT NULL,
  "recipient_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "author_id" integer NOT NULL,
  "author_name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "announcements_author_idx" ON "announcements" USING btree ("author_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "announcements" ADD CONSTRAINT "announcements_program_programs_id_fk" FOREIGN KEY ("program") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "announcement_reads" (
  "announcement_id" text NOT NULL,
  "user_id" integer NOT NULL,
  "read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "announcement_reads_pk" ON "announcement_reads" USING btree ("announcement_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "announcement_reads_user_idx" ON "announcement_reads" USING btree ("user_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
