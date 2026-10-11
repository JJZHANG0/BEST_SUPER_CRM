ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "profile" jsonb;
