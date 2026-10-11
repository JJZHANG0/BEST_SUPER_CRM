# PROJECT NEXUS — backend, environments and deployment

There are three ways the frontend runs:

| Build | Data | How |
|---|---|---|
| GitHub Pages demo (`npm run build:pages`) | Local demo store (seed data + localStorage) | No `NEXT_PUBLIC_API_BASE` → API code stays inert |
| Server **production** — http://1.13.182.30/ | PostgreSQL `nexus_prod` via `/api` | `scripts/deploy.sh prod` |
| Server **development** — http://1.13.182.30:8080/ | PostgreSQL `nexus_dev` via `/api` | `scripts/deploy.sh dev` (shows a DEV badge) |

## Architecture

- **Database**: PostgreSQL 16, schema in `db/schema.ts` (Drizzle ORM), SQL migrations in `drizzle/`
  (`npm run db:generate` after schema changes). Tables: `users`, `programs`, `teams` (cohorts),
  `students` (+ `health`, `health_by`, `health_changed_at`, `health_changed_by`),
  `student_status_history` (who/when for every status change), `enrollments`, `courses`,
  `feedbacks`, `assignments` (homework), `resources`, `articles` (draft + published JSON).
- **API**: `server/` — Hono on Node 22, bundled by esbuild into one file `server-dist/index.mjs`
  (`npm run build:server`), so the server needs no `npm install`.
  - `GET /api/health` · `POST /api/auth/login` · `GET /api/auth/me` · `GET /api/bootstrap`
  - `PUT /api/<collection>/<id>` (programs, teams, students, enrollments, courses, feedbacks,
    resources, assignments, articles) · `PATCH /api/students/<id>/status` · `GET /api/students/<id>/history`
  - Auth: scrypt-hashed passwords, HS256 JWT bearer tokens (12 h). Roles: `ops`/`admin` may write;
    `sales` is read-only and only receives its own students, visible feedback, public resources and
    published articles (drafts are never sent to sales).
  - `node index.mjs migrate` applies migrations; `node index.mjs seed` inserts the demo data from
    `lib/nexus/*` if missing (idempotent, never overwrites edits).
- **Frontend**: `lib/nexus/api.ts` + `lib/nexus/store.tsx`. With `NEXT_PUBLIC_API_BASE` set, login goes to the
  API, data is loaded from `/api/bootstrap`, every record the UI changes is written back with `PUT`, and other
  users' changes are picked up on focus / every 30 s. The session token is kept in localStorage.

## Server layout (1.13.182.30, TencentOS 3.3)

| | production | development |
|---|---|---|
| URL | http://1.13.182.30/ | http://1.13.182.30:8080/ |
| nginx | `:80` (default server) | `:8080` |
| API service | `nexus-api-prod` → 127.0.0.1:3001 | `nexus-api-dev` → 127.0.0.1:3002 |
| Database / DB user | `nexus_prod` / `nexus_prod` | `nexus_dev` / `nexus_dev` |
| Secrets (mode 600, root) | `/opt/nexus/prod/.env` | `/opt/nexus/dev/.env` |
| Releases | `/opt/nexus/prod/releases/<ts>-<sha>`, `current` symlink | `/opt/nexus/dev/releases/…` |

- `.env` holds `DATABASE_URL` (random per-environment DB password), `JWT_SECRET` (random), `PORT`, `NEXUS_ENV`.
  The values exist only on the server; they are generated once by `deploy/server-setup.sh` and never rotated by it.
- PostgreSQL listens on localhost only (`listen_addresses = 'localhost'`, scram auth); port 5432 is not public.
- nginx config: `/etc/nginx/conf.d/nexus.conf` (source `deploy/nginx-nexus.conf`); main config replaced, original
  kept as `/etc/nginx/nginx.conf.orig`.
- Services run as the unprivileged `nexus` user with systemd sandboxing. Logs: `journalctl -u nexus-api-prod -f`.
- 2 GiB swap file at `/swapfile`. firewalld is inactive; the Tencent security group must allow TCP 80 and 8080.

## Deploying

Builds run on the developer machine (the 2 GiB server is not used to build).

```bash
# one-time: provision a fresh server (idempotent; safe to re-run)
scp deploy/server-setup.sh deploy/nginx-nexus.conf root@1.13.182.30:/root/nexus-setup/
ssh root@1.13.182.30 'bash /root/nexus-setup/server-setup.sh'

# every release (Node 22 locally; SSH key ~/.ssh/nexus_deploy or NEXUS_SSH_KEY)
git checkout develop && scripts/deploy.sh dev     # → http://1.13.182.30:8080/
git checkout main    && scripts/deploy.sh prod    # → http://1.13.182.30/ (refuses a dirty tree)
scripts/api-smoke.sh http://1.13.182.30           # login + ops status change visible to sales
```

The script builds the static frontend with `NEXT_PUBLIC_API_BASE=/api`, bundles the API, uploads a release,
runs `migrate` + `seed`, switches the `current` symlink, restarts the service and rolls back if `/api/health`
fails. The five newest releases are kept.

**Branches**: `develop` → dev, `main` → prod. `.github/workflows/deploy.yml` automates this (push to `develop` →
dev; tag `v*` or manual run → prod) once the repo has secret `NEXUS_SSH_KEY` and variable
`NEXUS_DEPLOY_ENABLED=true`. GitHub Pages (`pages.yml`) keeps deploying the offline demo from `main`.

## Local development

```bash
cp .env.example .env
docker compose up -d db          # PostgreSQL 16 on 127.0.0.1:5432 (or use a local install)
npm run db:migrate && npm run db:seed
npm run api:dev                  # API on http://127.0.0.1:3001/api
NEXT_PUBLIC_API_BASE=http://127.0.0.1:3001/api npm run dev   # frontend against the local API
```

Schema change: edit `db/schema.ts` → `npm run db:generate` → commit the new `drizzle/*.sql` → deploy (migrations run
automatically).

## Accounts

The demo accounts from the README are seeded in both environments. Production is publicly reachable, so
replace them (or change their passwords in `users`) before storing real data. Real students' data should not
be entered until HTTPS (a domain + certificate) is in place.

## 推文 public links and link previews

Published 推文 (article posts) have a public, login-free reader:

| Build | Public URL | Link-preview tags |
| --- | --- | --- |
| GitHub Pages (static demo) | `https://jjzhang0.github.io/BEST_SUPER_CRM/#/p/<slug>` (e.g. `…/#/p/bpa-autumn-kickoff`) | Generic site card only (`og-default.png`). Crawlers never see the `#/p/…` hash, so per-article tags are impossible on a static SPA. Posts written on Pages live in that browser only; the bundled example posts open anywhere. |
| Server (nginx + API) | `https://<host>/a/<slug>` | Per-article `og:title`, `og:description`, `og:image` (cover PNG), `og:url`, served by the API (`server/posts.ts`, `GET /a/:slug`), which then redirects to `/#/p/<slug>`. Drafts / withdrawn posts get a generic 404 card. |

nginx must forward `/a/` to the API (already in `deploy/nginx-nexus.conf`):

```nginx
location /a/ {
    proxy_pass http://127.0.0.1:3001;   # 3002 on the dev server
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Optionally set `PUBLIC_ORIGIN=https://<host>` in the API env so `og:url` / `og:image` use the canonical
host instead of the request's `Host` header.

Public API (no auth; registered before the auth middleware):

- `GET  /api/public/articles/:slug?visitor=<id>` — published posts only (404 otherwise); no draft, no author email.
- `POST /api/public/articles/:slug/view|share|like` with `{ "visitor": "<8–64 chars [A-Za-z0-9_-]>" }`.
  Deduped in `article_post_events` (unique post+visitor+bucket): like once per visitor, view once per visitor per
  30 min, share once per visitor per minute; plus an in-memory per-IP throttle (120 writes/min). Counters live on
  `article_posts.views|shares|likes` and cannot be set by clients. The Pages build keeps the same rules in
  localStorage and labels the numbers 「预览站仅统计本机数据」.

Migration `drizzle/0005_article_posts.sql` adds `article_posts` and `article_post_events`; `seed` inserts the
example posts if missing. Regenerate the PNG covers / `og-default.png` with `scripts/render-og-images.cjs`.

### WeChat share cards (future step)

WeChat does not reliably use Open Graph tags. A custom share card (title, description, thumbnail) inside WeChat
requires the WeChat JS-SDK (`wx.updateAppMessageShareData` / `updateTimelineShareData`), which needs:
a **verified 公众号 (service account)**, the site on an **ICP-filed (备案) domain** configured as a JS-safe domain,
and a server endpoint that signs `jsapi_ticket` with the 公众号 AppSecret. None of that exists yet, so this build
does not attempt it. Until then WeChat shows the page title / link (sometimes the first large image); the public
page sets `document.title` to the article title and offers 「分享」 (copy link; Web Share API on phones outside WeChat).

## 部门负责人（leader）权限、排课与课表导出（migration 0006）

- `drizzle/0006_leader_sessions_lesson_teacher.sql` 新增 `users.leader`（默认 false，并把 `zhangjiejia@nexus.local` 设为 true）、`course_sessions` 表、`courses.code/location`、`lesson_records.teacher`。部署服务器时照常 `npm run db:migrate`（或启动时自动迁移），再 `npm run db:seed`（seed 只会给 staff 列表中标记 leader 的账号设置该标志，不会提升其他账号）。
- 权限只看 `leader` 标志，不再看 superadmin：部门负责人可查看全部老师的课时记录 / 课情反馈 / 教务津贴（按老师分开）、审核绩效、指派任务，且不填写当月绩效；其他超级管理员（程雪晴、张雪航）与运营老师只能看到并修改自己的记录与津贴。API（`/bootstrap`、`PUT/DELETE /:collection/:id`、`/kpi*`、`POST /todos`）与 Pages 预览两条路径同一套规则（`lib/nexus/roles.ts`）。
- 课程排课：新建课程可选「单次 / 每周重复（选上课日、开始日期、共 N 节或截止日期、开始/结束时间）/ 逐次添加」；每节课写入 `course_sessions`，今日课程 / 本周课程 / 课程日历按节显示。
- 导出课表：课程管理 →「导出课表」，按「我的课程 / 某位授课老师 / 某个项目」与起始周、周数生成周一至周日 × 时间段的课表，浏览器端用 canvas 绘制并下载 PNG 或 PDF（A4 横版，每周一页，无第三方依赖）。
