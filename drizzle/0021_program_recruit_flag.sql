-- Manual 招募 flag on a project (已满员 / 停止招生): hides it from the sales 火热招募 tile.
ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "recruit_flag" text;
