/**
 * PROJECT NEXUS API (Hono), mounted under /api behind nginx.
 * Roles: ops/admin may write; sales are read-only and only see their own students,
 * public resources, visible feedback and published articles.
 */
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { asc, desc, eq, max, min, sql } from 'drizzle-orm';
import type { Db } from './db';
import { schema } from './db';
import type { Config } from './config';
import { verifyPassword } from './password';
import { shanghaiStamp } from './stamp';
import { isCollection, recordSchemas, tables, toRecord, type CollectionName } from './collections';
import { isValidArticle, articleIssues, type ProgramArticle } from '../lib/nexus/articles';

export type SessionUser = { id: number; email: string; name: string; role: 'ops' | 'sales' | 'admin'; salesName: string | null };
type Env = { Variables: { user: SessionUser } };
const TOKEN_TTL = 60 * 60 * 12;
const canWrite = (u: SessionUser) => u.role === 'ops' || u.role === 'admin';
const publicUser = (u: SessionUser) => ({ id: u.id, email: u.email, name: u.name, role: u.role, salesName: u.salesName });
const toSession = (row: typeof schema.users.$inferSelect): SessionUser => ({ id: row.id, email: row.email, name: row.name, role: row.role as SessionUser['role'], salesName: row.salesName });
const issuesOf = (e: { issues: { path: PropertyKey[]; message: string }[] }) => e.issues.map(i => i.path.join('.') + ': ' + i.message);

export function createApp(db: Db, config: Config, startedAt = new Date()) {
  const app = new Hono<Env>().basePath('/api');
  if (config.corsOrigins.length) app.use('*', cors({ origin: config.corsOrigins, allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
  app.onError((err, c) => { console.error(err); return c.json({ error: 'internal_error' }, 500); });
  app.notFound(c => c.json({ error: 'not_found' }, 404));

  app.get('/health', async c => {
    let database = 'ok';
    try { await db.execute(sql`select 1`); } catch { database = 'error'; }
    return c.json({ status: database === 'ok' ? 'ok' : 'degraded', env: config.env, database, uptime: Math.round((Date.now() - startedAt.getTime()) / 1000) }, database === 'ok' ? 200 : 503);
  });

  // Simple per-IP throttle for failed logins (20 per 10 minutes).
  const attempts = new Map<string, { n: number; until: number }>();
  app.post('/auth/login', async c => {
    const ip = c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const now = Date.now(), slot = attempts.get(ip);
    if (slot && slot.until > now && slot.n >= 20) return c.json({ error: 'too_many_attempts' }, 429);
    const body = await c.req.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const [row] = email ? await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1) : [];
    if (!row || !row.active || !(await verifyPassword(password, row.passwordHash))) {
      attempts.set(ip, slot && slot.until > now ? { n: slot.n + 1, until: slot.until } : { n: 1, until: now + 600_000 });
      return c.json({ error: 'invalid_credentials' }, 401);
    }
    attempts.delete(ip);
    const user = toSession(row);
    const token = await sign({ sub: String(user.id), role: user.role, exp: Math.floor(now / 1000) + TOKEN_TTL }, config.jwtSecret, 'HS256');
    return c.json({ token, user: publicUser(user), expiresIn: TOKEN_TTL });
  });

  // Everything below requires a valid bearer token.
  app.use('*', async (c, next) => {
    const header = c.req.header('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return c.json({ error: 'unauthorized' }, 401);
    let payload: { sub?: unknown };
    try { payload = await verify(token, config.jwtSecret, 'HS256') as { sub?: unknown }; } catch { return c.json({ error: 'unauthorized' }, 401); }
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, Number(payload.sub))).limit(1);
    if (!row || !row.active) return c.json({ error: 'unauthorized' }, 401);
    c.set('user', toSession(row));
    await next();
  });
  const forbidden = (c: Context) => c.json({ error: 'forbidden', message: '此操作仅项目运营老师可用' }, 403);

  app.get('/auth/me', c => c.json({ user: publicUser(c.get('user')) }));

  async function list(name: CollectionName) {
    const t = tables[name] as typeof schema.teams;
    const rows = await db.select().from(t).orderBy(asc(t.sortOrder), asc(t.createdAt));
    return rows.map(r => toRecord(name, r as unknown as Record<string, unknown>));
  }
  const todoRow = (r: typeof schema.todos.$inferSelect) => ({
    id: r.id, userId: r.userId, title: r.title, note: r.note ?? null,
    dueAt: r.dueAt ? r.dueAt.toISOString() : null, completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  });
  const parseDue = (v: unknown) => {
    if (v == null || v === '') return null;
    if (typeof v !== 'string') return undefined;
    const d = new Date(v.length <= 10 ? v + 'T12:00:00+08:00' : v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  app.get('/todos', async c => {
    const user = c.get('user');
    const rows = await db.select().from(schema.todos).where(eq(schema.todos.userId, user.id)).orderBy(desc(schema.todos.createdAt));
    return c.json({ todos: rows.map(todoRow) });
  });

  app.post('/todos', async c => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null) as { title?: unknown; note?: unknown; dueAt?: unknown } | null;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 200) return c.json({ error: 'invalid', issues: ['title required (1–200)'] }, 400);
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 2000) : null;
    const dueAt = parseDue(body?.dueAt);
    if (dueAt === undefined) return c.json({ error: 'invalid', issues: ['dueAt'] }, 400);
    const id = 'TODO-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const now = new Date();
    const [row] = await db.insert(schema.todos).values({ id, userId: user.id, title, note: note || null, dueAt, completedAt: null, createdAt: now, updatedAt: now }).returning();
    return c.json({ todo: todoRow(row) }, 201);
  });

  app.patch('/todos/:id', async c => {
    const user = c.get('user'), id = c.req.param('id');
    const [current] = await db.select().from(schema.todos).where(eq(schema.todos.id, id)).limit(1);
    if (!current || current.userId !== user.id) return c.json({ error: 'not_found' }, 404);
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return c.json({ error: 'invalid' }, 400);
    const patch: Partial<typeof schema.todos.$inferInsert> = { updatedAt: new Date() };
    if ('title' in body) {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title || title.length > 200) return c.json({ error: 'invalid', issues: ['title'] }, 400);
      patch.title = title;
    }
    if ('note' in body) patch.note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) || null : null;
    if ('dueAt' in body) {
      const dueAt = parseDue(body.dueAt);
      if (dueAt === undefined) return c.json({ error: 'invalid', issues: ['dueAt'] }, 400);
      patch.dueAt = dueAt;
    }
    if ('completedAt' in body) {
      if (body.completedAt === null || body.completedAt === '') patch.completedAt = null;
      else if (typeof body.completedAt === 'string') {
        const d = new Date(body.completedAt);
        if (Number.isNaN(d.getTime())) return c.json({ error: 'invalid', issues: ['completedAt'] }, 400);
        patch.completedAt = d;
      } else if (body.completedAt === true) patch.completedAt = new Date();
      else return c.json({ error: 'invalid', issues: ['completedAt'] }, 400);
    }
    const [row] = await db.update(schema.todos).set(patch).where(eq(schema.todos.id, id)).returning();
    return c.json({ todo: todoRow(row) });
  });

  app.delete('/todos/:id', async c => {
    const user = c.get('user'), id = c.req.param('id');
    const [current] = await db.select().from(schema.todos).where(eq(schema.todos.id, id)).limit(1);
    if (!current || current.userId !== user.id) return c.json({ error: 'not_found' }, 404);
    await db.delete(schema.todos).where(eq(schema.todos.id, id));
    return c.json({ ok: true as const });
  });

  /** Everything the signed-in user may see, in the frontend's shapes. */
  app.get('/bootstrap', async c => {
    const user = c.get('user');
    const [programs, teams, students, enrollments, courses, feedbacks, resources, assignments] = await Promise.all((['programs', 'teams', 'students', 'enrollments', 'courses', 'feedbacks', 'resources', 'assignments'] as const).map(list));
    const articleRows = await db.select().from(schema.articles);
    const todoRows = await db.select().from(schema.todos).where(eq(schema.todos.userId, user.id)).orderBy(desc(schema.todos.createdAt));
    const todos = todoRows.map(todoRow);
    let articles = articleRows.map(a => ({ program: a.program, author: a.author, draft: a.draft, published: a.published ?? null, updated: a.updated, publishedAt: a.publishedAt ?? null })) as ProgramArticle[];
    if (user.role !== 'sales') return c.json({ user: publicUser(user), programs, teams, students, enrollments, courses, feedbacks, resources, assignments, articles, todos });
    // Sales: own students only, no drafts, public files, visible feedback.
    const mine = students.filter(s => s.sales === user.salesName);
    const ids = new Set(mine.map(s => s.id as string));
    articles = articles.filter(a => a.published).map(a => ({ ...a, draft: a.published! }));
    return c.json({
      user: publicUser(user),
      programs: programs.map(p => { const rest = { ...p }; delete rest.draft; return rest; }),
      teams, students: mine,
      enrollments: enrollments.filter(e => ids.has(e.student as string)),
      courses, feedbacks: feedbacks.filter(f => f.visible && ids.has(f.student as string)),
      resources: resources.filter(r => r.public), assignments: assignments.filter(a => ids.has(a.student as string)), articles, todos,
    });
  });

  app.get('/students/:id/history', async c => {
    const user = c.get('user'), id = c.req.param('id');
    const [student] = await db.select().from(schema.students).where(eq(schema.students.id, id)).limit(1);
    if (!student || (user.role === 'sales' && student.sales !== user.salesName)) return c.json({ error: 'not_found' }, 404);
    const rows = await db.select().from(schema.studentStatusHistory).where(eq(schema.studentStatusHistory.studentId, id)).orderBy(desc(schema.studentStatusHistory.changedAt)).limit(50);
    return c.json({ history: rows.map(r => ({ health: r.health, healthNote: r.healthNote, previousHealth: r.previousHealth, by: r.changedByName, at: r.changedAt })) });
  });

  async function saveStudent(data: Record<string, unknown>, user: SessionUser) {
    return db.transaction(async tx => {
      const [current] = await tx.select().from(schema.students).where(eq(schema.students.id, data.id as string)).for('update').limit(1);
      const healthChanged = !current || current.health !== data.health || current.healthNote !== data.healthNote;
      const now = new Date();
      const values = { ...data, ...(healthChanged ? { healthUpdated: shanghaiStamp(now), healthBy: user.name, healthChangedAt: now, healthChangedBy: user.id } : { healthUpdated: current.healthUpdated, healthBy: current.healthBy }), updatedAt: now } as typeof schema.students.$inferInsert;
      let row: typeof schema.students.$inferSelect;
      if (current) [row] = await tx.update(schema.students).set(values).where(eq(schema.students.id, current.id)).returning();
      else {
        const [{ m }] = await tx.select({ m: max(schema.students.sortOrder) }).from(schema.students);
        [row] = await tx.insert(schema.students).values({ ...values, sortOrder: (m ?? 0) + 1 }).returning();
      }
      if (healthChanged) await tx.insert(schema.studentStatusHistory).values({ studentId: row.id, health: row.health, healthNote: row.healthNote, previousHealth: current?.health ?? null, changedBy: user.id, changedByName: user.name, changedAt: now });
      return toRecord('students', row as unknown as Record<string, unknown>);
    });
  }

  /** Status-only change for one student (ops). */
  app.patch('/students/:id/status', async c => {
    const user = c.get('user');
    if (!canWrite(user)) return forbidden(c);
    const body = await c.req.json().catch(() => null) as { health?: unknown; healthNote?: unknown } | null;
    const [current] = await db.select().from(schema.students).where(eq(schema.students.id, c.req.param('id'))).limit(1);
    if (!current) return c.json({ error: 'not_found' }, 404);
    const parsed = recordSchemas.students.safeParse({ ...toRecord('students', current as unknown as Record<string, unknown>), health: body?.health, healthNote: typeof body?.healthNote === 'string' ? body.healthNote : current.healthNote });
    if (!parsed.success) return c.json({ error: 'invalid', issues: issuesOf(parsed.error) }, 400);
    return c.json({ record: await saveStudent(parsed.data, user) });
  });


  /** Upsert one record of a collection (ops/admin). The body is the full frontend record. */
  app.put('/:collection/:id', async c => {
    const user = c.get('user'), name = c.req.param('collection'), id = c.req.param('id');
    if (name !== 'articles' && !isCollection(name)) return c.json({ error: 'not_found' }, 404);
    if (!canWrite(user)) return forbidden(c);
    const body = await c.req.json().catch(() => null);
    if (name === 'articles') {
      if (!isValidArticle(body) || body.program !== id) return c.json({ error: 'invalid' }, 400);
      if (body.published) { const issues = articleIssues(body.published); if (issues.length) return c.json({ error: 'invalid', issues }, 400); }
      if (JSON.stringify(body).length > 6_000_000) return c.json({ error: 'too_large' }, 413);
      const [program] = await db.select({ id: schema.programs.id }).from(schema.programs).where(eq(schema.programs.id, id)).limit(1);
      if (!program) return c.json({ error: 'not_found' }, 404);
      const values = { program: id, author: body.author, draft: body.draft, published: body.published, updated: body.updated, publishedAt: body.publishedAt, updatedBy: user.id, updatedAt: new Date() };
      const [row] = await db.insert(schema.articles).values(values).onConflictDoUpdate({ target: schema.articles.program, set: values }).returning();
      return c.json({ record: { program: row.program, author: row.author, draft: row.draft, published: row.published ?? null, updated: row.updated, publishedAt: row.publishedAt ?? null } });
    }
    if (!isCollection(name)) return c.json({ error: 'not_found' }, 404);
    const parsed = recordSchemas[name].safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: issuesOf(parsed.error) }, 400);
    if (parsed.data.id !== id) return c.json({ error: 'invalid', issues: ['id mismatch'] }, 400);
    if (name === 'students') return c.json({ record: await saveStudent(parsed.data, user) });
    const t = tables[name] as typeof schema.teams; // every table has id, sortOrder, updatedAt
    const data = { ...parsed.data } as Record<string, unknown>;
    for (const [k, v] of Object.entries(recordSchemas[name].shape)) if ((v as { isOptional(): boolean }).isOptional() && data[k] === undefined) data[k] = null;
    const now = new Date();
    try {
      const [existing] = await db.select({ id: t.id }).from(t).where(eq(t.id, id)).limit(1);
      let row;
      if (existing) [row] = await db.update(t).set({ ...data, updatedAt: now } as never).where(eq(t.id, id)).returning();
      else {
        // New feedback is listed first; everything else is appended.
        const [{ m }] = await db.select({ m: name === 'feedbacks' ? min(t.sortOrder) : max(t.sortOrder) }).from(t);
        [row] = await db.insert(t).values({ ...data, sortOrder: name === 'feedbacks' ? (m ?? 0) - 1 : (m ?? 0) + 1 } as never).returning();
      }
      return c.json({ record: toRecord(name, row as unknown as Record<string, unknown>) });
    } catch (err) {
      // Foreign-key violations (unknown programme / student) are client errors.
      if ((err as { cause?: { code?: string }; code?: string }).cause?.code === '23503' || (err as { code?: string }).code === '23503') return c.json({ error: 'invalid', issues: ['unknown reference'] }, 400);
      throw err;
    }
  });

  return app;
}
