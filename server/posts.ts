/**
 * 推文 API. Two halves:
 *   public (no login)  GET  /api/public/articles/:slug            published posts only
 *                      POST /api/public/articles/:slug/view|share|like   { visitor } — idempotent per visitor
 *                                                                   (lib/nexus/posts.ts bucketFor) + per-IP throttle
 *   signed in          GET  /api/posts      ops: all · sales: published snapshots only
 *                      PUT  /api/posts/:id  ops / superadmin: create or update (draft → publish → withdraw)
 * plus the Open Graph shell for link previews at /a/:slug (outside /api; see docs/DEPLOY.md for nginx).
 * Storage goes through PostRepo so the routes can be tested without PostgreSQL (tests/posts.mjs).
 */
import type { Context, Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import type { Db } from './db';
import { schema } from './db';
import { canWrite } from '../lib/nexus/roles';
import { cleanContent, type ArticleContent } from '../lib/nexus/articles';
import { bucketFor, isPostShape, isPublic, isSlug, isVisitorId, metricField, metricKinds, postIssues, shareShellHtml, visiblePosts, type ArticlePost, type MetricKind } from '../lib/nexus/posts';

export type ProgramInfo = { id: string; name: string; short: string; type: string; color: string };
export interface PostRepo {
  list(): Promise<ArticlePost[]>;
  byId(id: string): Promise<ArticlePost | null>;
  bySlug(slug: string): Promise<ArticlePost | null>;
  program(id: string): Promise<ProgramInfo | null>;
  /** Insert or update everything except the counters. Throws { code: '23505' } when the slug belongs to another post. */
  save(post: ArticlePost, userId: number | null): Promise<ArticlePost>;
  liked(postId: string, visitor: string): Promise<boolean>;
  /** Record a dedupe key; bumps the counter and returns true only the first time the key is seen. */
  track(postId: string, visitor: string, kind: MetricKind, bucket: string): Promise<boolean>;
}
type Session = { id: number; email: string; role: string };

/** "YYYY-MM-DD HH:mm" in Asia/Shanghai (the format the browser store uses). */
export function shanghaiDateTime(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}
const parseStamp = (s: string | null | undefined) => { if (!s) return null; const d = new Date(s.length === 16 ? s.replace(' ', 'T') + ':00+08:00' : s); return Number.isNaN(d.getTime()) ? null : d; };

/** Public view of a live post: no draft, no author email. */
export function publicArticle(p: ArticlePost, program: ProgramInfo | null) {
  const c = p.published!;
  return { slug: p.slug, title: c.title, summary: c.summary, cover: c.cover, blocks: c.blocks, author: p.author, publishedAt: p.publishedAt, metrics: p.metrics,
    program: program ? { id: program.id, name: program.name, short: program.short, type: program.type, color: program.color } : null };
}

export function memoryRepo(seed: ArticlePost[] = [], programs: ProgramInfo[] = []): PostRepo & { events: Set<string>; posts: Map<string, ArticlePost> } {
  const posts = new Map(seed.map(p => [p.id, structuredClone(p)])), events = new Set<string>();
  return {
    posts, events,
    async list() { return [...posts.values()].map(p => structuredClone(p)); },
    async byId(id) { const p = posts.get(id); return p ? structuredClone(p) : null; },
    async bySlug(slug) { const p = [...posts.values()].find(x => x.slug === slug); return p ? structuredClone(p) : null; },
    async program(id) { return programs.find(p => p.id === id) ?? null; },
    async save(post) {
      if ([...posts.values()].some(x => x.slug === post.slug && x.id !== post.id)) throw Object.assign(new Error('slug taken'), { code: '23505' });
      const prev = posts.get(post.id);
      const next = { ...structuredClone(post), metrics: prev ? prev.metrics : { views: 0, shares: 0, likes: 0 } };
      posts.set(post.id, next); return structuredClone(next);
    },
    async liked(postId, visitor) { return events.has(`${postId}|${visitor}|like`); },
    async track(postId, visitor, kind, bucket) {
      const key = `${postId}|${visitor}|${bucket}`;
      if (events.has(key)) return false;
      events.add(key); const p = posts.get(postId)!; p.metrics[metricField(kind)] += 1; return true;
    },
  };
}

type PostRow = typeof schema.articlePosts.$inferSelect;
const fromRow = (r: PostRow): ArticlePost => ({
  id: r.id, slug: r.slug, program: r.projectId, status: r.status as ArticlePost['status'], author: r.author, authorEmail: r.authorEmail,
  draft: r.draft as ArticleContent, published: (r.published as ArticleContent | null) ?? null,
  createdAt: shanghaiDateTime(r.createdAt), updated: shanghaiDateTime(r.updatedAt), publishedAt: r.publishedAt ? shanghaiDateTime(r.publishedAt) : null,
  metrics: { views: r.views, shares: r.shares, likes: r.likes },
});
export function drizzleRepo(db: Db): PostRepo {
  const t = schema.articlePosts, ev = schema.articlePostEvents;
  return {
    async list() { return (await db.select().from(t).orderBy(sql`coalesce(${t.publishedAt}, ${t.updatedAt}) desc`)).map(fromRow); },
    async byId(id) { const [r] = await db.select().from(t).where(eq(t.id, id)).limit(1); return r ? fromRow(r) : null; },
    async bySlug(slug) { const [r] = await db.select().from(t).where(eq(t.slug, slug)).limit(1); return r ? fromRow(r) : null; },
    async program(id) { const [r] = await db.select({ id: schema.programs.id, name: schema.programs.name, short: schema.programs.short, type: schema.programs.type, color: schema.programs.color }).from(schema.programs).where(eq(schema.programs.id, id)).limit(1); return r ?? null; },
    async save(p, userId) {
      const now = new Date();
      const values = { slug: p.slug, projectId: p.program, status: p.status, author: p.author, authorEmail: p.authorEmail, draft: p.draft, published: p.published, publishedAt: parseStamp(p.publishedAt), updatedBy: userId, updatedAt: now };
      const [r] = await db.insert(t).values({ id: p.id, ...values, createdBy: userId, createdAt: parseStamp(p.createdAt) ?? now }).onConflictDoUpdate({ target: t.id, set: values }).returning();
      return fromRow(r);
    },
    async liked(postId, visitor) { const [r] = await db.select({ id: ev.id }).from(ev).where(and(eq(ev.postId, postId), eq(ev.visitor, visitor), eq(ev.bucket, 'like'))).limit(1); return !!r; },
    async track(postId, visitor, kind, bucket) {
      return db.transaction(async tx => {
        const inserted = await tx.insert(ev).values({ postId, visitor, kind, bucket }).onConflictDoNothing().returning({ id: ev.id });
        if (!inserted.length) return false;
        const set = kind === 'view' ? { views: sql`${t.views} + 1` } : kind === 'share' ? { shares: sql`${t.shares} + 1` } : { likes: sql`${t.likes} + 1` };
        await tx.update(t).set(set).where(eq(t.id, postId));
        return true;
      });
    },
  };
}

/** Fixed-window per-key throttle (default 120 public writes per IP per minute). */
export function throttle(limit = 120, windowMs = 60_000) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (key: string, now = Date.now()) => {
    if (hits.size > 20_000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    const h = hits.get(key);
    if (!h || h.reset <= now) { hits.set(key, { n: 1, reset: now + windowMs }); return true; }
    h.n += 1; return h.n <= limit;
  };
}
const clientIp = (c: Context) => c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mounted on the API app whose Env carries the session user
type AnyApp = Hono<any, any, any>;
export function registerPublicPostRoutes(app: AnyApp, repo: PostRepo, allow = throttle()) {
  app.get('/public/articles/:slug', async c => {
    const slug = c.req.param('slug');
    const post = isSlug(slug) ? await repo.bySlug(slug) : null;
    if (!post || !isPublic(post)) return c.json({ error: 'not_found', message: '该推文不存在或已撤回' }, 404);
    const visitor = c.req.query('visitor');
    c.header('Cache-Control', 'no-store');
    return c.json({ article: publicArticle(post, await repo.program(post.program)), liked: isVisitorId(visitor) ? await repo.liked(post.id, visitor) : false });
  });
  app.post('/public/articles/:slug/:kind', async c => {
    const slug = c.req.param('slug'), kind = c.req.param('kind') as MetricKind;
    if (!metricKinds.includes(kind)) return c.json({ error: 'not_found' }, 404);
    if (!allow(clientIp(c))) return c.json({ error: 'too_many_requests' }, 429);
    const body = await c.req.json().catch(() => null) as { visitor?: unknown } | null;
    if (!isVisitorId(body?.visitor)) return c.json({ error: 'invalid', message: 'visitor id required' }, 400);
    const post = isSlug(slug) ? await repo.bySlug(slug) : null;
    if (!post || !isPublic(post)) return c.json({ error: 'not_found' }, 404);
    const counted = await repo.track(post.id, body.visitor, kind, bucketFor(kind, Date.now()));
    const fresh = (await repo.byId(post.id))!;
    return c.json({ counted, metrics: fresh.metrics, liked: kind === 'like' ? true : await repo.liked(post.id, body.visitor) });
  });
}

/** Validate a submitted post against the stored one and apply the workflow rules. Returns the record to save or an error. */
export function prepareSave(body: unknown, id: string, current: ArticlePost | null, user: Session, now: string): { ok: true; post: ArticlePost } | { ok: false; status: 400 | 409; message: string; issues?: string[] } {
  if (!isPostShape(body) || body.id !== id) return { ok: false, status: 400, message: '推文数据格式不正确' };
  if (JSON.stringify(body).length > 6_000_000) return { ok: false, status: 400, message: '推文内容过大，请压缩图片' };
  if (current && current.slug !== body.slug) return { ok: false, status: 400, message: '推文链接（slug）创建后不能修改' };
  if (current && current.program !== body.program) return { ok: false, status: 400, message: '推文所属项目不能修改' };
  const base = { ...body, author: body.author.trim().slice(0, 40), authorEmail: current?.authorEmail ?? user.email.toLowerCase(), createdAt: current?.createdAt ?? now, updated: now, metrics: current?.metrics ?? { views: 0, shares: 0, likes: 0 } };
  if (body.status === 'published') {
    if (!body.published) return { ok: false, status: 400, message: '发布时需要附带发布版本' };
    const issues = postIssues({ author: base.author, draft: body.published });
    if (issues.length) return { ok: false, status: 400, message: issues[0], issues };
    const published = cleanContent(body.published);
    const same = current?.status === 'published' && JSON.stringify(current.published) === JSON.stringify(published);
    return { ok: true, post: { ...base, published, publishedAt: same ? current!.publishedAt : now } };
  }
  if (body.status === 'withdrawn') {
    if (!current || current.status === 'draft') return { ok: false, status: 409, message: '只有已发布的推文可以撤回' };
    return { ok: true, post: { ...base, published: null, publishedAt: current.publishedAt } };
  }
  // draft
  if (current && current.status !== 'draft') return { ok: false, status: 409, message: '已发布过的推文请使用「撤回」或重新发布' };
  return { ok: true, post: { ...base, published: null, publishedAt: null } };
}

export function registerPostRoutes(app: AnyApp, repo: PostRepo) {
  app.get('/posts', async c => { const user = c.get('user') as Session; return c.json({ posts: visiblePosts(await repo.list(), user.role) }); });
  app.put('/posts/:id', async c => {
    const user = c.get('user') as Session, id = c.req.param('id');
    if (!canWrite(user.role)) return c.json({ error: 'forbidden', message: '编辑与发布推文仅对项目运营老师开放' }, 403);
    const body = await c.req.json().catch(() => null);
    const current = await repo.byId(id);
    const r = prepareSave(body, id, current, user, shanghaiDateTime(new Date()));
    if (!r.ok) return c.json({ error: r.status === 409 ? 'conflict' : 'invalid', message: r.message, issues: r.issues }, r.status);
    if (!(await repo.program(r.post.program))) return c.json({ error: 'invalid', message: '所属项目不存在' }, 400);
    try { return c.json({ record: await repo.save(r.post, user.id > 0 ? user.id : null) }); }
    catch (err) {
      const code = (err as { code?: string; cause?: { code?: string } }).cause?.code || (err as { code?: string }).code;
      if (code === '23505') return c.json({ error: 'conflict', message: '推文链接已被占用，请刷新后重试' }, 409);
      throw err;
    }
  });
}

/** /a/:slug — HTML shell with per-article Open Graph tags, then redirect into the SPA. */
export function registerShareShell(app: AnyApp, repo: PostRepo, publicOrigin = '') {
  app.get('/a/:slug', async c => {
    const slug = c.req.param('slug');
    const post = isSlug(slug) ? await repo.bySlug(slug) : null;
    const live = post && isPublic(post) ? post : null;
    const proto = c.req.header('x-forwarded-proto') || new URL(c.req.url).protocol.replace(':', '');
    const host = c.req.header('x-forwarded-host') || c.req.header('host') || new URL(c.req.url).host;
    const origin = publicOrigin || `${proto}://${host}`;
    const html = shareShellHtml({ origin, slug: isSlug(slug) ? slug : 'invalid', article: live ? { title: live.published!.title, summary: live.published!.summary, cover: live.published!.cover, program: live.program } : null });
    c.header('Cache-Control', 'public, max-age=60');
    return c.html(html, live ? 200 : 404);
  });
}
