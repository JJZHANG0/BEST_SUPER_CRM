ALTER TABLE "teams" ADD COLUMN "year" integer DEFAULT 2026 NOT NULL;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "public_intro" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "intake_year" integer DEFAULT 2026 NOT NULL;
