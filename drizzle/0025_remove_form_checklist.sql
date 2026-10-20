-- 收集表单: drop the 「填写前请核对」 section + required checklist (replaced by a confirm-preview step). Old submissions keep their answer snapshots.
UPDATE "forms" f SET "version" = f."version" + 1, "updated_at" = now()
WHERE EXISTS (SELECT 1 FROM "form_questions" q WHERE q."form_id" = f."id" AND (q."id" = f."id" || ':q23' OR q."id" = f."id" || ':s7'));
--> statement-breakpoint
DELETE FROM "form_questions" q USING "forms" f
WHERE q."form_id" = f."id" AND (
  (q."id" = f."id" || ':q23' AND q."type" = 'multi' AND q."require_all" = true) OR
  (q."id" = f."id" || ':s7' AND q."type" = 'section' AND q."label_zh" = '填写前请核对'));
