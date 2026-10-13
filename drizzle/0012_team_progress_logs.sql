ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "progress" jsonb;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "materials" jsonb;
CREATE TABLE IF NOT EXISTS "team_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "team" text NOT NULL,
  "at" text NOT NULL,
  "by" text DEFAULT '' NOT NULL,
  "by_name" text NOT NULL,
  "action" text NOT NULL,
  "detail" text DEFAULT '' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
  ALTER TABLE "team_logs" ADD CONSTRAINT "team_logs_team_teams_id_fk" FOREIGN KEY ("team") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "team_logs_team_idx" ON "team_logs" USING btree ("team");
