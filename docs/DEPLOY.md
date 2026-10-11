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
