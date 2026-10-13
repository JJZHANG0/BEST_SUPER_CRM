/**
 * PROJECT NEXUS API (Hono), mounted under /api behind nginx.
 * Roles (lib/nexus/roles.ts): ops/admin/superadmin may write shared data; sales are read-only and
 * only see their own students, public resources, visible feedback and published articles.
 * 系统管理 (users, 项目, 课程, 班型与津贴) is superadmin-only; 课时记录 / 课情反馈 are owned per
 * 教务老师 — ops read and write their own, superadmins all.
 */
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { and, asc, desc, eq, inArray, max, min, or, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import type { Db } from './db';
import { schema } from './db';
import type { Config } from './config';
import { hashPassword, verifyPassword } from './password';
import { shanghaiStamp } from './stamp';
import { isCollection, recordSchemas, tables, toRecord, systemCollections, ownedCollections, scheduleCollections, deletableCollections, type CollectionName } from './collections';
import { canWrite as roleCanWrite, canManageSystem, canSeeAllLessons, canEditOwned, canAssignTodos, canReviewKpi, canFillKpi, isOpsLike, isRole, passwordIssues, normalizeUsername, usernameIssue, type Role } from '../lib/nexus/roles';
import { isMonth, normalizeItems, ownerView, reviewSheet, teacherSave, type KpiSheet, type KpiStatus } from '../lib/nexus/kpi';
import { computeAllowance, normalizeLesson, isUnit } from '../lib/nexus/ops';
import { isValidArticle, articleIssues, type ProgramArticle } from '../lib/nexus/articles';
import { visiblePosts } from '../lib/nexus/posts';
import { drizzleRepo, registerPostRoutes, registerPublicPostRoutes, registerShareShell, type PostRepo } from './posts';
import { isThemeId, DEFAULT_THEME } from '../lib/nexus/themes';
import { courseCodeIssue, knownCourseCodeIssue, normalizeCourseCode, scheduleConflicts, conflictSummary, type CourseLike, type CourseSession } from '../lib/nexus/schedule';

/** `leader` = 部门负责人 flag (users.leader); permission helpers in lib/nexus/roles.ts take the whole user. */
export type SessionUser = { id: number; email: string; username: string | null; name: string; role: Role; salesName: string | null; mustChangePassword: boolean; leader: boolean; avatar: string | null; theme: string };
type Env = { Variables: { user: SessionUser } };
const TOKEN_TTL = 60 * 60 * 12;
const canWrite = (u: SessionUser) => roleCanWrite(u.role);
const publicUser = (u: SessionUser) => ({ id: u.id, email: u.email, username: u.username, name: u.name, role: u.role, salesName: u.salesName, mustChangePassword: u.mustChangePassword, leader: u.leader, avatar: u.avatar, theme: u.theme });
const toSession = (row: typeof schema.users.$inferSelect): SessionUser => ({ id: row.id, email: row.email, username: row.username, name: row.name, role: row.role as Role, salesName: row.salesName, mustChangePassword: row.mustChangePassword, leader: row.leader === true, avatar: row.avatar ?? null, theme: isThemeId(row.theme) ? row.theme : DEFAULT_THEME });
const adminUser = (row: typeof schema.users.$inferSelect) => ({ id: row.id, email: row.email, username: row.username, name: row.name, role: row.role as Role, active: row.active, mustChangePassword: row.mustChangePassword, salesName: row.salesName, leader: row.leader === true });
/** Random 16-character password without look-alike characters (upper, lower, digit, symbol). */
/** Human message for a unique violation on users (username vs email). */
function conflictMessage(err: unknown) {
  const e = err as { constraint?: string; constraint_name?: string; detail?: string; message?: string; cause?: { constraint?: string; detail?: string; message?: string } };
  // Use the driver error (constraint / detail), not drizzle's wrapper message, which echoes the whole SQL column list.
  const d = e?.cause ?? e;
  const text = [d?.constraint, (d as { constraint_name?: string })?.constraint_name, d?.detail].filter(Boolean).join(' ') || String(d?.message || '');
  return /username/i.test(text) ? '该用户名已被使用' : /email/i.test(text) ? '该邮箱已被使用' : '该账号已存在';
}
export function generatePassword(length = 16) {
  const all = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?';
  for (;;) {
    let pw = '';
    for (let i = 0; i < length; i++) pw += all[randomInt(all.length)];
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) return pw;
  }
}
const pgCode = (err: unknown) => (err as { cause?: { code?: string } }).cause?.code || (err as { code?: string }).code;
const issuesOf = (e: { issues: { path: PropertyKey[]; message: string }[] }) => e.issues.map(i => i.path.join('.') + ': ' + i.message);

/**
 * `posts` lets tests inject an in-memory 推文 store; production uses PostgreSQL.
 * Returns the root app: /api/* (JSON API) plus /a/:slug (Open Graph share shell, proxied by nginx).
 */
export function createApp(db: Db, config: Config, startedAt = new Date(), posts: PostRepo = drizzleRepo(db)) {
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
    // `login` is a username (e.g. 张捷嘉) or an email; `email` is accepted for older clients.
    const body = await c.req.json().catch(() => null) as { login?: unknown; email?: unknown; password?: unknown } | null;
    const raw = typeof body?.login === 'string' ? body.login : typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const ident = raw.includes('@') ? raw.trim().toLowerCase() : normalizeUsername(raw).toLowerCase();
    const [row] = !ident ? [] : raw.includes('@')
      ? await db.select().from(schema.users).where(eq(schema.users.email, ident)).limit(1)
      : await db.select().from(schema.users).where(sql`lower(${schema.users.username}) = ${ident}`).limit(1);
    if (!row || !row.active || !(await verifyPassword(password, row.passwordHash))) {
      attempts.set(ip, slot && slot.until > now ? { n: slot.n + 1, until: slot.until } : { n: 1, until: now + 600_000 });
      return c.json({ error: 'invalid_credentials' }, 401);
    }
    attempts.delete(ip);
    const user = toSession(row);
    const token = await sign({ sub: String(user.id), role: user.role, exp: Math.floor(now / 1000) + TOKEN_TTL }, config.jwtSecret, 'HS256');
    return c.json({ token, user: publicUser(user), expiresIn: TOKEN_TTL });
  });

  // 推文 public reader + metrics: no login (registered before the auth middleware).
  registerPublicPostRoutes(app, posts);

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

  const onlySuperadmin = (c: Context) => c.json({ error: 'forbidden', message: '此操作仅超级管理员可用' }, 403);

  app.get('/auth/me', c => c.json({ user: publicUser(c.get('user')) }));

  app.post('/auth/avatar', async c => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null) as { avatar?: unknown } | null;
    const avatar = body?.avatar === null ? null : typeof body?.avatar === 'string' ? body.avatar : undefined;
    if (avatar === undefined) return c.json({ error: 'invalid', message: '请提供 avatar（data URL 或 null）' }, 400);
    if (avatar !== null) {
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(avatar) || avatar.length > 900_000) {
        return c.json({ error: 'invalid', message: '头像需为 PNG/JPEG/WebP data URL，且体积适中' }, 400);
      }
    }
    const [row] = await db.update(schema.users).set({ avatar, updatedAt: new Date() }).where(eq(schema.users.id, user.id)).returning();
    return c.json({ user: publicUser(toSession(row)) });
  });

  app.post('/auth/theme', async c => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null) as { theme?: unknown } | null;
    const theme = typeof body?.theme === 'string' ? body.theme : undefined;
    if (!isThemeId(theme)) return c.json({ error: 'invalid', message: '请选择有效的主题配色' }, 400);
    const [row] = await db.update(schema.users).set({ theme, updatedAt: new Date() }).where(eq(schema.users.id, user.id)).returning();
    return c.json({ user: publicUser(toSession(row)) });
  });


  // 推文 authoring (ops / superadmin write; sales read published snapshots). Before the generic /:collection/:id.
  registerPostRoutes(app, posts);

  app.post('/auth/change-password', async c => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null) as { current?: unknown; next?: unknown } | null;
    const current = typeof body?.current === 'string' ? body.current : '', next = typeof body?.next === 'string' ? body.next : '';
    const issues = passwordIssues(next);
    if (issues.length) return c.json({ error: 'invalid', message: '新密码' + issues.join('，') }, 400);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
    if (!row || !(await verifyPassword(current, row.passwordHash))) return c.json({ error: 'invalid_credentials' }, 401);
    if (current === next) return c.json({ error: 'invalid', message: '新密码不能与当前密码相同' }, 400);
    await db.update(schema.users).set({ passwordHash: await hashPassword(next), mustChangePassword: false, updatedAt: new Date() }).where(eq(schema.users.id, user.id));
    return c.json({ ok: true as const });
  });

  // ---- 系统管理 · 用户管理 (superadmin) ----
  app.get('/admin/users', async c => {
    if (!canManageSystem(c.get('user').role)) return onlySuperadmin(c);
    const rows = await db.select().from(schema.users).orderBy(asc(schema.users.id));
    return c.json({ users: rows.map(adminUser) });
  });
  app.post('/admin/users', async c => {
    if (!canManageSystem(c.get('user').role)) return onlySuperadmin(c);
    const body = await c.req.json().catch(() => null) as { email?: unknown; username?: unknown; name?: unknown; role?: unknown; salesName?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
    if (!name) return c.json({ error: 'invalid', message: '请填写姓名' }, 400);
    const username = normalizeUsername(body?.username ?? name);
    const uIssue = usernameIssue(username);
    if (uIssue) return c.json({ error: 'invalid', message: uIssue }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return c.json({ error: 'invalid', message: '请输入有效的邮箱（作为备用登录账号）' }, 400);
    if (!isRole(body?.role) || body.role === 'admin') return c.json({ error: 'invalid', message: '未知角色' }, 400);
    const salesName = body.role === 'sales' ? (typeof body.salesName === 'string' && body.salesName.trim() ? body.salesName.trim().slice(0, 80) : '顾问 ' + name) : null;
    const password = generatePassword();
    try {
      const [row] = await db.insert(schema.users).values({ email, username, name, role: body.role, salesName, passwordHash: await hashPassword(password), mustChangePassword: true }).returning();
      return c.json({ user: adminUser(row), password }, 201);
    } catch (err) {
      if (pgCode(err) === '23505') return c.json({ error: 'conflict', message: conflictMessage(err) }, 409);
      throw err;
    }
  });
  app.patch('/admin/users/:id', async c => {
    const me = c.get('user');
    if (!canManageSystem(me.role)) return onlySuperadmin(c);
    const id = Number(c.req.param('id'));
    const [row] = Number.isInteger(id) ? await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1) : [];
    if (!row) return c.json({ error: 'not_found' }, 404);
    const body = await c.req.json().catch(() => null) as { name?: unknown; username?: unknown; role?: unknown; active?: unknown } | null;
    const patch: Partial<typeof schema.users.$inferInsert> = { updatedAt: new Date() };
    if (body?.username !== undefined) { const username = normalizeUsername(body.username); const issue = usernameIssue(username); if (issue) return c.json({ error: 'invalid', message: issue }, 400); patch.username = username; }
    if (typeof body?.name === 'string') { const name = body.name.trim().replace(/\s+/g, ' ').slice(0, 80); if (!name) return c.json({ error: 'invalid', message: '请填写姓名' }, 400); patch.name = name; }
    if (body?.role !== undefined) { if (!isRole(body.role)) return c.json({ error: 'invalid', message: '未知角色' }, 400); patch.role = body.role; if (body.role === 'sales' && !row.salesName) patch.salesName = '顾问 ' + (patch.name ?? row.name); }
    if (body?.active !== undefined) { if (typeof body.active !== 'boolean') return c.json({ error: 'invalid' }, 400); patch.active = body.active; }
    if (row.id === me.id && ((patch.role && patch.role !== row.role) || patch.active === false)) return c.json({ error: 'invalid', message: '不能修改自己的角色或停用自己的账号' }, 400);
    try {
      const [updated] = await db.update(schema.users).set(patch).where(eq(schema.users.id, id)).returning();
      return c.json({ user: adminUser(updated) });
    } catch (err) {
      if (pgCode(err) === '23505') return c.json({ error: 'conflict', message: conflictMessage(err) }, 409);
      throw err;
    }
  });
  app.post('/admin/users/:id/reset-password', async c => {
    if (!canManageSystem(c.get('user').role)) return onlySuperadmin(c);
    const id = Number(c.req.param('id'));
    const [row] = Number.isInteger(id) ? await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1) : [];
    if (!row) return c.json({ error: 'not_found' }, 404);
    const password = generatePassword();
    await db.update(schema.users).set({ passwordHash: await hashPassword(password), mustChangePassword: true, updatedAt: new Date() }).where(eq(schema.users.id, id));
    return c.json({ password });
  });

  async function list(name: CollectionName) {
    const t = tables[name] as typeof schema.teams;
    const rows = await db.select().from(t).orderBy(asc(t.sortOrder), asc(t.createdAt));
    return rows.map(r => toRecord(name, r as unknown as Record<string, unknown>));
  }
  type TodoOwner = { name: string; email: string } | null;
  const todoRow = (r: typeof schema.todos.$inferSelect, owner: TodoOwner = null) => ({
    id: r.id, userId: r.userId, title: r.title, note: r.note ?? null,
    dueAt: r.dueAt ? r.dueAt.toISOString() : null, completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    assignedBy: r.assignedBy ?? null, assignedByName: r.assignedByName ?? null,
    ownerName: owner?.name ?? null, ownerEmail: owner?.email ?? null,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  });
  const parseDue = (v: unknown) => {
    if (v == null || v === '') return null;
    if (typeof v !== 'string') return undefined;
    const d = new Date(v.length <= 10 ? v + 'T12:00:00+08:00' : v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  /** Own todos plus the ones this user assigned to others (「我指派的」), with the owner's name. */
  async function todosFor(user: SessionUser) {
    const rows = await db.select({ t: schema.todos, name: schema.users.name, email: schema.users.email }).from(schema.todos)
      .innerJoin(schema.users, eq(schema.users.id, schema.todos.userId))
      .where(or(eq(schema.todos.userId, user.id), eq(schema.todos.assignedBy, user.id)))
      .orderBy(desc(schema.todos.createdAt));
    return rows.map(r => todoRow(r.t, { name: r.name, email: r.email }));
  }
  async function ownerOf(userId: number): Promise<TodoOwner> {
    const [u] = await db.select({ name: schema.users.name, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    return u ?? null;
  }

  app.get('/todos', async c => c.json({ todos: await todosFor(c.get('user')) }));

  /** Personal todo, or (superadmin) a todo assigned to another ops teacher via `assignee` (email). */
  app.post('/todos', async c => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null) as { title?: unknown; note?: unknown; dueAt?: unknown; assignee?: unknown } | null;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 200) return c.json({ error: 'invalid', issues: ['title required (1–200)'] }, 400);
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 2000) : null;
    const dueAt = parseDue(body?.dueAt);
    if (dueAt === undefined) return c.json({ error: 'invalid', issues: ['dueAt'] }, 400);
    let ownerId = user.id, assignedBy: number | null = null, assignedByName: string | null = null;
    const assignee = typeof body?.assignee === 'string' ? body.assignee.trim().toLowerCase() : '';
    if (assignee && assignee !== user.email) {
      if (!canAssignTodos(user)) return c.json({ error: 'forbidden', message: '只有部门负责人可以指派任务' }, 403);
      const [target] = await db.select().from(schema.users).where(eq(schema.users.email, assignee)).limit(1);
      if (!target || !target.active || !isOpsLike(target.role)) return c.json({ error: 'invalid', message: '请选择在职的运营老师' }, 400);
      ownerId = target.id; assignedBy = user.id; assignedByName = user.name;
    }
    const id = 'TODO-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const now = new Date();
    const [row] = await db.insert(schema.todos).values({ id, userId: ownerId, title, note: note || null, dueAt, completedAt: null, assignedBy, assignedByName, createdAt: now, updatedAt: now }).returning();
    return c.json({ todo: todoRow(row, await ownerOf(ownerId)) }, 201);
  });

  /**
   * Owner edits their personal todos. For assigned todos the assignee only completes / restores,
   * and the assigner may edit title / note / DDL (not the completion state).
   */
  app.patch('/todos/:id', async c => {
    const user = c.get('user'), id = c.req.param('id');
    const [current] = await db.select().from(schema.todos).where(eq(schema.todos.id, id)).limit(1);
    const isOwner = current?.userId === user.id, isAssigner = !!current?.assignedBy && current.assignedBy === user.id;
    if (!current || (!isOwner && !isAssigner)) return c.json({ error: 'not_found' }, 404);
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return c.json({ error: 'invalid' }, 400);
    const assigned = current.assignedBy != null && current.assignedBy !== current.userId;
    if (assigned && isOwner && !isAssigner && ['title', 'note', 'dueAt'].some(k => k in body)) return c.json({ error: 'forbidden', message: '指派的任务只能由指派人修改内容' }, 403);
    if (assigned && isAssigner && !isOwner && 'completedAt' in body) return c.json({ error: 'forbidden', message: '指派的任务由负责老师标记完成' }, 403);
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
    return c.json({ todo: todoRow(row, await ownerOf(row.userId)) });
  });

  /** Personal todos: owner. Assigned todos: only the assigner withdraws them. */
  app.delete('/todos/:id', async c => {
    const user = c.get('user'), id = c.req.param('id');
    const [current] = await db.select().from(schema.todos).where(eq(schema.todos.id, id)).limit(1);
    if (!current || (current.userId !== user.id && current.assignedBy !== user.id)) return c.json({ error: 'not_found' }, 404);
    const assigned = current.assignedBy != null && current.assignedBy !== current.userId;
    if (assigned && current.assignedBy !== user.id) return c.json({ error: 'forbidden', message: '指派的任务只能由指派人撤回' }, 403);
    await db.delete(schema.todos).where(eq(schema.todos.id, id));
    return c.json({ ok: true as const });
  });

  // ---- 当月绩效 (self-fill) and 绩效考核 (review) ----
  const kpiRow = (r: typeof schema.kpiSheets.$inferSelect, userName: string): KpiSheet => ({
    id: String(r.id), userKey: String(r.userId), userName, month: r.month, status: r.status as KpiStatus, items: normalizeItems(r.items),
    submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null, reviewedByName: r.reviewedByName ?? null, reviewNote: r.reviewNote,
    finalizedAt: r.finalizedAt ? r.finalizedAt.toISOString() : null, total: r.total ?? null, updatedAt: r.updatedAt.toISOString(),
  });
  const kpiOf = async (userId: number, month: string) => (await db.select().from(schema.kpiSheets).where(and(eq(schema.kpiSheets.userId, userId), eq(schema.kpiSheets.month, month))).limit(1))[0];

  app.get('/kpi/:month', async c => {
    const user = c.get('user'), month = c.req.param('month');
    if (!canFillKpi(user)) return c.json({ error: 'forbidden', message: '部门负责人不填写当月绩效' }, 403);
    if (!isMonth(month)) return c.json({ error: 'invalid', message: '月份格式应为 YYYY-MM' }, 400);
    const row = await kpiOf(user.id, month);
    return c.json({ sheet: row ? ownerView(kpiRow(row, user.name)) : null });
  });

  /** Save own draft (and optionally submit). Only drafts can be edited by the teacher (rules: lib/nexus/kpi.ts teacherSave). */
  app.put('/kpi/:month', async c => {
    const user = c.get('user'), month = c.req.param('month');
    if (!canFillKpi(user)) return c.json({ error: 'forbidden', message: '部门负责人不填写当月绩效' }, 403);
    if (!isMonth(month)) return c.json({ error: 'invalid', message: '月份格式应为 YYYY-MM' }, 400);
    const body = await c.req.json().catch(() => null) as { items?: unknown; submit?: unknown } | null;
    const current = await kpiOf(user.id, month);
    const result = teacherSave(current ? kpiRow(current, user.name) : null, { id: '', userKey: String(user.id), userName: user.name, month }, body?.items, body?.submit === true);
    if (!result.ok) return c.json({ error: result.status === 409 ? 'conflict' : 'invalid', message: result.error }, result.status);
    const { sheet } = result;
    const values = { items: sheet.items, status: sheet.status, submittedAt: sheet.submittedAt ? new Date(sheet.submittedAt) : null, updatedAt: new Date(sheet.updatedAt) };
    const [row] = current
      ? await db.update(schema.kpiSheets).set(values).where(eq(schema.kpiSheets.id, current.id)).returning()
      : await db.insert(schema.kpiSheets).values({ ...values, userId: user.id, month }).returning();
    return c.json({ sheet: ownerView(kpiRow(row, user.name)) });
  });

  /** Reviewer: every ops teacher (plus anyone who filled a sheet) for one month. */
  app.get('/kpi-review/:month', async c => {
    const user = c.get('user'), month = c.req.param('month');
    if (!canReviewKpi(user)) return c.json({ error: 'forbidden', message: '此操作仅部门负责人可用' }, 403);
    if (!isMonth(month)) return c.json({ error: 'invalid', message: '月份格式应为 YYYY-MM' }, 400);
    const sheets = await db.select().from(schema.kpiSheets).where(eq(schema.kpiSheets.month, month));
    const ids = sheets.map(r => r.userId);
    // Every active ops-workspace teacher who fills 当月绩效 (not the 部门负责人), plus anyone with a sheet.
    const teachers = and(inArray(schema.users.role, ['ops', 'superadmin', 'admin']), eq(schema.users.active, true), eq(schema.users.leader, false));
    const people = (await db.select().from(schema.users).where(ids.length ? or(teachers, inArray(schema.users.id, ids)) : teachers).orderBy(asc(schema.users.id))).filter(p => p.id !== user.id && !p.leader);
    return c.json({ rows: people.map(p => { const r = sheets.find(x => x.userId === p.id); return { user: { key: String(p.id), name: p.name, email: p.email, role: p.role }, sheet: r ? kpiRow(r, p.name) : null }; }) });
  });

  /** Reviewer: score / finalize / return to draft / reopen a finalized sheet (rules: lib/nexus/kpi.ts reviewSheet). */
  app.put('/kpi-review/:userId/:month', async c => {
    const user = c.get('user'), month = c.req.param('month'), userId = Number(c.req.param('userId'));
    if (!canReviewKpi(user)) return c.json({ error: 'forbidden', message: '此操作仅部门负责人可用' }, 403);
    if (!isMonth(month) || !Number.isInteger(userId)) return c.json({ error: 'invalid' }, 400);
    const body = await c.req.json().catch(() => null) as { items?: unknown; reviewNote?: unknown; action?: unknown } | null;
    const current = await kpiOf(userId, month);
    const [owner] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    const result = reviewSheet(current ? kpiRow(current, owner?.name || '') : null, { action: body?.action ?? 'save', items: body?.items, reviewNote: body?.reviewNote, reviewerKey: String(user.id), reviewerName: user.name });
    if (!result.ok) return c.json({ error: result.status === 409 ? 'conflict' : result.status === 404 ? 'not_found' : result.status === 403 ? 'forbidden' : 'invalid', message: result.error }, result.status);
    const { sheet } = result;
    const [row] = await db.update(schema.kpiSheets).set({
      items: sheet.items, status: sheet.status, reviewNote: sheet.reviewNote ?? '', submittedAt: sheet.submittedAt ? new Date(sheet.submittedAt) : null,
      finalizedAt: sheet.finalizedAt ? new Date(sheet.finalizedAt) : null, total: sheet.total ?? null, updatedAt: new Date(sheet.updatedAt),
      ...(body?.action === 'reopen' ? {} : { reviewedBy: user.id, reviewedByName: user.name }),
    }).where(eq(schema.kpiSheets.id, current!.id)).returning();
    return c.json({ sheet: kpiRow(row, owner?.name || '') });
  });

  /** Everything the signed-in user may see, in the frontend's shapes. */
  app.get('/bootstrap', async c => {
    const user = c.get('user');
    const [programs, teams, teamLogs, students, enrollments, courses, feedbacks, resources, assignments, classTypes, projects, opsCourses, lessons, lessonFeedbacks, teachers, courseSessions] = await Promise.all((['programs', 'teams', 'teamLogs', 'students', 'enrollments', 'courses', 'feedbacks', 'resources', 'assignments', 'classTypes', 'projects', 'opsCourses', 'lessons', 'lessonFeedbacks', 'teachers', 'courseSessions'] as const).map(list));
    const staffRows = await db.select().from(schema.users).orderBy(asc(schema.users.id));
    const staff = staffRows.filter(u => isOpsLike(u.role)).map(u => ({ email: u.email, name: u.name, role: u.role, active: u.active, leader: u.leader === true }));
    // 课时 / 课情反馈 / 津贴: the 部门负责人 sees every teacher's; everyone else (incl. other superadmins) only their own.
    const own = (r: Record<string, unknown>) => canSeeAllLessons(user) || String(r.opsTeacher).toLowerCase() === user.email;
    const articleRows = await db.select().from(schema.articles);
    const todos = await todosFor(user);
    const postList = visiblePosts(await posts.list(), user.role);
    let articles = articleRows.map(a => ({ program: a.program, author: a.author, draft: a.draft, published: a.published ?? null, updated: a.updated, publishedAt: a.publishedAt ?? null })) as ProgramArticle[];
    if (user.role !== 'sales') return c.json({ user: publicUser(user), programs, teams, teamLogs, students, enrollments, courses, feedbacks, resources, assignments, articles, posts: postList, todos, classTypes, projects, teachers, opsCourses, lessons: lessons.filter(own), lessonFeedbacks: lessonFeedbacks.filter(own), staff, courseSessions });
    // Sales: own students only, no drafts, public files, visible feedback.
    const mine = students.filter(s => s.sales === user.salesName);
    const ids = new Set(mine.map(s => s.id as string));
    articles = articles.filter(a => a.published).map(a => ({ ...a, draft: a.published! }));
    return c.json({
      user: publicUser(user),
      programs: programs.map(p => { const rest = { ...p }; delete rest.draft; return rest; }),
      teams, teamLogs: [], students: mine,
      enrollments: enrollments.filter(e => ids.has(e.student as string)),
      courses, feedbacks: feedbacks.filter(f => f.visible && ids.has(f.student as string)),
      resources: resources.filter(r => r.public), assignments: assignments.filter(a => ids.has(a.student as string)), articles, posts: postList, todos,
      classTypes: [], projects: [], teachers: [], opsCourses: [], lessons: [], lessonFeedbacks: [], staff: [],
      courseSessions: courseSessions.filter(x => courses.some(c => c.id === x.course)),
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


  /** 课程编号 format / uniqueness and 排课冲突 (same teacher, team or room) unless the course was saved with 「仍然保存」. */
  async function scheduleGuard(name: 'courses' | 'courseSessions', data: Record<string, unknown>, id: string): Promise<{ status: 400 | 409; body: { error: string; message: string; conflicts?: unknown[] } } | null> {
    const clean = (r: Record<string, unknown>) => { const o: Record<string, unknown> = {}; for (const [k, v] of Object.entries(r)) if (v !== null) o[k] = v; return o; };
    const courses = (await db.select().from(schema.courses)).map(r => clean(r as unknown as Record<string, unknown>)) as unknown as (CourseLike & { conflictOverride?: boolean })[];
    const sessions = (await db.select().from(schema.courseSessions)).map(r => clean(r as unknown as Record<string, unknown>)) as unknown as CourseSession[];
    if (name === 'courses') {
      const current = courses.find(x => x.id === id);
      const code = typeof data.code === 'string' ? data.code : '';
      if (code && normalizeCourseCode(code) !== normalizeCourseCode(current?.code)) {
        const opsCodes = await db.select({ code: schema.opsCourses.code }).from(schema.opsCourses);
        const known = knownCourseCodeIssue(code, opsCodes);
        if (known) return { status: 400, body: { error: 'invalid', message: known } };
        const issue = courseCodeIssue(code, courses, id);
        if (issue) return { status: issue.includes('已被') ? 409 : 400, body: { error: issue.includes('已被') ? 'conflict' : 'invalid', message: issue } };
        data.code = normalizeCourseCode(code);
      }
      if (data.conflictOverride === true) return null;
      const changed = !current || current.teacher !== data.teacher || current.team !== data.team || (current.location || '') !== (data.location || '');
      if (!changed) return null;
      const own = sessions.filter(x => x.course === id);
      const t = String(data.time || '').split(/[–—~-]/).map(x => x.trim());
      const slots = own.length ? own : (t.length === 2 ? [{ date: String(data.date), start: t[0], end: t[1] }] : []);
      const hits = scheduleConflicts(slots, { courseId: id, teacher: String(data.teacher || ''), team: String(data.team || ''), location: String(data.location || '') }, courses, sessions);
      return hits.length ? { status: 409, body: { error: 'schedule_conflict', message: '排课冲突：' + conflictSummary(hits) + '。如确需安排，请在表单中选择「仍然保存」。', conflicts: hits } } : null;
    }
    const course = courses.find(x => x.id === data.course);
    if (!course || course.conflictOverride) return null; // the course PUT re-checks its sessions when it arrives
    const current = sessions.find(x => x.id === id);
    if (current && current.date === data.date && current.start === data.start && current.end === data.end && (current.location || '') === (data.location || '')) return null;
    const hits = scheduleConflicts([{ date: String(data.date), start: String(data.start), end: String(data.end), location: (data.location as string) || course.location }], { courseId: course.id, teacher: course.teacher, team: course.team, location: course.location }, courses, sessions);
    return hits.length ? { status: 409, body: { error: 'schedule_conflict', message: '排课冲突：' + conflictSummary(hits) + '。如确需安排，请在表单中选择「仍然保存」。', conflicts: hits } } : null;
  }

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
    // Older clients still send `students`: migrate it to 实到人数 (actualCount) before validating.
    const parsed = recordSchemas[name].safeParse(name === 'lessons' && body && typeof body === 'object' ? normalizeLesson(body) : body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: issuesOf(parsed.error) }, 400);
    if (parsed.data.id !== id) return c.json({ error: 'invalid', issues: ['id mismatch'] }, 400);
    if (name === 'students') return c.json({ record: await saveStudent(parsed.data, user) });
    const t = tables[name] as typeof schema.teams; // every table has id, sortOrder, updatedAt
    const data = { ...parsed.data } as Record<string, unknown>;
    if (systemCollections.includes(name) && !canManageSystem(user.role)) return onlySuperadmin(c);
    if (ownedCollections.includes(name)) {
      const [current] = await db.select().from(t).where(eq(t.id, id)).limit(1) as unknown as Record<string, unknown>[];
      if (!canEditOwned(user, user.email, String(data.opsTeacher)) || (current && !canEditOwned(user, user.email, String(current.opsTeacher)))) return c.json({ error: 'forbidden', message: '只能记录或修改自己的课时与反馈' }, 403);
      data.opsTeacher = String(data.opsTeacher).toLowerCase();
      data.createdBy = current ? current.createdBy : user.email;
      const [course] = await db.select().from(schema.opsCourses).where(eq(schema.opsCourses.id, String(data.course))).limit(1);
      if (!course) return c.json({ error: 'invalid', message: '课程不存在' }, 400);
      if (name === 'lessons') {
        // Snapshot the class type's rate when the record is created or moved to another course; the API computes the amount.
        let rate = current ? Number(current.rate) : NaN, unit = current ? String(current.unit) : '';
        if (!current || current.course !== data.course) {
          const [type] = await db.select().from(schema.classTypes).where(eq(schema.classTypes.id, course.classType)).limit(1);
          if (!type) return c.json({ error: 'invalid', message: '课程的班级类型不存在' }, 400);
          rate = type.rate; unit = type.unit;
        }
        if (!isUnit(unit)) return c.json({ error: 'invalid', message: '津贴单位无效' }, 400);
        if (unit === 'person_hour' && !(Number(data.actualCount) > 0)) return c.json({ error: 'invalid', message: '该班型按人数计算，请填写实到人数' }, 400);
        data.rate = rate; data.unit = unit; data.amount = computeAllowance(rate, unit, Number(data.hours), data.actualCount as number | null);
      }
    }
    if (name === 'courses' || name === 'courseSessions') {
      const blocked = await scheduleGuard(name, data, id);
      if (blocked) return c.json(blocked.body, blocked.status);
    }
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
      if (pgCode(err) === '23503') return c.json({ error: 'invalid', issues: ['unknown reference'], message: '引用的记录不存在' }, 400);
      if (pgCode(err) === '23505') return c.json({ error: 'conflict', message: '编号已存在，请使用其他编号' }, 409);
      throw err;
    }
  });

  /** Delete one record of an ops collection (系统管理: superadmin; 课时/反馈: owner or superadmin). */
  app.delete('/:collection/:id', async c => {
    const user = c.get('user'), name = c.req.param('collection'), id = c.req.param('id');
    if (!isCollection(name) || !deletableCollections.includes(name)) return c.json({ error: 'not_found' }, 404);
    const t = tables[name] as typeof schema.teams;
    const [current] = await db.select().from(t).where(eq(t.id, id)).limit(1) as unknown as Record<string, unknown>[];
    if (!current) return c.json({ error: 'not_found' }, 404);
    const allowed = systemCollections.includes(name) ? canManageSystem(user.role) : scheduleCollections.includes(name) ? canWrite(user) : canEditOwned(user, user.email, String(current.opsTeacher));
    if (!allowed) return c.json({ error: 'forbidden', message: '没有权限删除此记录' }, 403);
    try {
      if (name === 'lessons') await db.update(schema.lessonFeedbacks).set({ lesson: null }).where(eq(schema.lessonFeedbacks.lesson, id));
      await db.delete(t).where(eq(t.id, id));
    } catch (err) {
      if (pgCode(err) === '23503') return c.json({ error: 'in_use', message: '该记录仍被其他数据引用，无法删除' }, 409);
      throw err;
    }
    return c.json({ ok: true as const });
  });

  const root = new Hono();
  registerShareShell(root, posts, config.publicOrigin);
  root.route('/', app);
  return root;
}
