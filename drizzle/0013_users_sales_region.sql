ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sales_region" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sales_lead" boolean DEFAULT false NOT NULL;
