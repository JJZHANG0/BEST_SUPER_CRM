-- 收集表单: rename the seeded form and update the Q05 HK/Macao permit option (same position, new value/labels).
UPDATE "forms" SET "title" = '报名学员竞赛信息收集表', "title_en" = 'STUDENT COMPETITION INFORMATION FORM', "updated_at" = now()
WHERE "title" = '各项竞赛报名学员信息收集表';
--> statement-breakpoint
UPDATE "form_questions" q SET "options" = (
  SELECT jsonb_agg(CASE WHEN e->>'value' = '港澳通行证'
    THEN jsonb_build_object('value', '港澳居民来往内地通行证', 'zh', '港澳居民来往内地通行证', 'en', 'MAINLAND TRAVEL PERMIT FOR HONG KONG AND MACAO RESIDENTS')
    ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(q."options") WITH ORDINALITY AS x(e, ord)
), "updated_at" = now()
WHERE q."options" @> '[{"value":"港澳通行证"}]'::jsonb;
--> statement-breakpoint
UPDATE "forms" f SET "version" = f."version" + 1, "updated_at" = now()
WHERE EXISTS (SELECT 1 FROM "form_questions" q WHERE q."form_id" = f."id" AND q."options" @> '[{"value":"港澳居民来往内地通行证"}]'::jsonb);
