ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "calendar_feed_token" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_calendar_feed_token_idx" ON "users" USING btree ("calendar_feed_token");
