ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_idx" ON "users" USING btree (lower("username"));--> statement-breakpoint
-- Backfill: existing accounts sign in with their name when it is unambiguous (no '@', unique case-insensitively).
UPDATE "users" u SET "username" = btrim(regexp_replace(u."name", '\s+', ' ', 'g'))
WHERE u."username" IS NULL AND position('@' in u."name") = 0 AND btrim(u."name") <> ''
  AND (SELECT count(*) FROM "users" x WHERE lower(btrim(regexp_replace(x."name", '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(u."name", '\s+', ' ', 'g')))) = 1;
