ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "weather_city" text DEFAULT '杭州' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_hours" (
  "user_id" integer NOT NULL,
  "month" text NOT NULL,
  "total_ms" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "work_hours" ADD CONSTRAINT "work_hours_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "work_hours_user_month_idx" ON "work_hours" USING btree ("user_id","month");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_hours_user_idx" ON "work_hours" USING btree ("user_id");
