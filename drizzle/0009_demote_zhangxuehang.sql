-- 张雪航 is a regular 项目运营老师 (ops), not a superadmin. Data fix for databases seeded before 2026-10-11.
-- Only touches the exact staff row while it still carries the old seeded role; never promotes anyone.
UPDATE "users" SET "role" = 'ops', "updated_at" = now() WHERE lower("email") = 'zhangxuehang@nexus.local' AND "role" = 'superadmin';
