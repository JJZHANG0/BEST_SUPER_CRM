/**
 * 收集表单 API. Public (no login): GET/POST /api/public/forms/:slug — honeypot + minimum fill time + per-IP throttle.
 * Admin (superadmin only, enforced here on every route): /api/admin/forms*, /api/admin/form-submissions*.
 * Storage goes through FormRepo so tests run the real routes on an in-memory store.
 */
import type { Context, Hono } from 'hono';
import { asc, desc, eq, max } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Db } from './db';
import { schema } from './db';
import { throttle } from './posts';
import { shanghaiStamp } from './stamp';
import { canManageSystem, type Role } from '../lib/nexus/roles';
import {
  DEFAULT_FORM, findDuplicates, hasOptions, identityOf, isFormSlug, isProfileTarget, isQuestionType, isSubmissionStatus, planAssignment, snapshotAnswers, validateAnswers,
  type AssignPlan, type EnrollmentLike, type FormDef, type FormOption, type FormQuestion, type StudentLike, type Submission, type SubmissionStatus,
} from '../lib/nexus/forms';

export type FormRepo = {
  forms(): Promise<FormDef[]>;
  form(id: string): Promise<FormDef | null>;
  formBySlug(slug: string): Promise<FormDef | null>;
  saveForm(def: FormDef, isNew: boolean): Promise<FormDef>;
  deleteForm(id: string): Promise<void>;
  submissions(formId?: string): Promise<Submission[]>;
  submission(id: string): Promise<Submission | null>;
  addSubmission(s: Submission & { ip: string; userAgent: string }): Promise<void>;
  updateSubmission(id: string, patch: Partial<Submission>): Promise<Submission | null>;
  deleteSubmission(id: string): Promise<void>;
  students(): Promise<StudentLike[]>;
  enrollments(): Promise<EnrollmentLike[]>;
  team(id: string): Promise<{ id: string; program: string; name: string } | null>;
  /** Persist one assignment atomically: student upsert, enrollment upsert, submission → 已分配. */
  applyAssignment(plan: AssignPlan, submissionId: string, patch: Partial<Submission>, by: { id: number; name: string }): Promise<void>;
};

const rid = (p: string) => p + randomBytes(6).toString('hex').toUpperCase();
export const newSlug = () => 'signup-' + randomBytes(4).toString('hex');
const clientIp = (c: Context) => c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
const s = (v: unknown, max = 500) => typeof v === 'string' ? v.trim().slice(0, max) : '';

/** Admin payload → clean FormDef (throws a Chinese message on bad input). */
export function cleanForm(body: unknown, base: FormDef): FormDef {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const title = s(b.title ?? base.title, 200);
  if (!title) throw new Error('请填写表单标题');
  const slug = b.slug === undefined ? base.slug : s(b.slug, 60).toLowerCase();
  if (!isFormSlug(slug)) throw new Error('链接标识需为 4–60 位小写字母、数字或连字符');
  const rawQs = Array.isArray(b.questions) ? b.questions : base.questions;
  if (rawQs.length > 200) throw new Error('题目过多');
  const ids = new Set<string>();
  const questions: FormQuestion[] = rawQs.map((raw: unknown, i: number) => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const type = r.type;
    if (!isQuestionType(type)) throw new Error(`第 ${i + 1} 题：未知题型`);
    let id = s(r.id, 40);
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || ids.has(id)) id = 'q' + randomBytes(4).toString('hex');
    ids.add(id);
    const labelZh = s(r.labelZh, 300);
    if (!labelZh) throw new Error(`第 ${i + 1} 题：请填写中文标题`);
    const options: FormOption[] = hasOptions(type) ? (Array.isArray(r.options) ? r.options : []).slice(0, 100).map((x: unknown) => {
      const ox = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const zh = s(ox.zh, 300), value = s(ox.value, 120) || zh.slice(0, 120);
      return { value, zh: zh || value, en: s(ox.en, 300), ...(ox.other === true ? { other: true } : {}) };
    }).filter(x => x.value) : [];
    if (hasOptions(type) && !options.length) throw new Error(`第 ${i + 1} 题「${labelZh}」：请至少添加一个选项`);
    if (new Set(options.map(x => x.value)).size !== options.length) throw new Error(`第 ${i + 1} 题「${labelZh}」：选项重复`);
    const mapTo = typeof r.mapTo === 'string' ? r.mapTo : '';
    return { id, type, labelZh, labelEn: s(r.labelEn, 300), helpZh: s(r.helpZh, 1000), helpEn: s(r.helpEn, 1000), placeholder: s(r.placeholder, 300),
      required: type !== 'section' && r.required === true, options, requireAll: type === 'multi' && r.requireAll === true, mapTo: isProfileTarget(mapTo) ? mapTo : '' };
  });
  const changed = JSON.stringify(questions) !== JSON.stringify(base.questions);
  return { ...base, title, slug, titleEn: s(b.titleEn ?? base.titleEn, 300), intro: s(b.intro ?? base.intro, 3000), introEn: s(b.introEn ?? base.introEn, 3000),
    open: typeof b.open === 'boolean' ? b.open : base.open, questions, version: base.version + (changed ? 1 : 0) };
}

/** Public projection: never leaks mapping targets. */
const publicForm = (f: FormDef) => ({ slug: f.slug, title: f.title, titleEn: f.titleEn, intro: f.intro, introEn: f.introEn, open: f.open, version: f.version,
  questions: f.questions.map(q => ({ id: q.id, type: q.type, labelZh: q.labelZh, labelEn: q.labelEn, helpZh: q.helpZh, helpEn: q.helpEn, placeholder: q.placeholder, required: q.required, options: q.options, requireAll: q.requireAll })) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mounted on the API app whose Env carries the session user
type AnyApp = Hono<any, any, any>;
const MIN_FILL_MS = 4000;
export function registerPublicFormRoutes(app: AnyApp, repo: FormRepo, perIp = throttle(8, 10 * 60_000), global = throttle(600, 60 * 60_000)) {
  app.get('/public/forms/:slug', async c => {
    const slug = c.req.param('slug');
    const form = isFormSlug(slug) ? await repo.formBySlug(slug) : null;
    if (!form) return c.json({ error: 'not_found', message: '表单不存在或链接已失效' }, 404);
    c.header('Cache-Control', 'no-store');
    return c.json({ form: publicForm(form) });
  });
  app.post('/public/forms/:slug', async c => {
    const slug = c.req.param('slug');
    const len = Number(c.req.header('content-length') || 0);
    if (len > 64_000) return c.json({ error: 'too_large', message: '内容过长' }, 413);
    const form = isFormSlug(slug) ? await repo.formBySlug(slug) : null;
    if (!form) return c.json({ error: 'not_found', message: '表单不存在或链接已失效' }, 404);
    if (!form.open) return c.json({ error: 'closed', message: '该表单已停止收集' }, 403);
    const body = await c.req.json().catch(() => null) as { answers?: unknown; website?: unknown; elapsed?: unknown } | null;
    if (!body || typeof body.answers !== 'object' || body.answers === null || Array.isArray(body.answers)) return c.json({ error: 'invalid', message: '提交内容无效' }, 400);
    // Honeypot: bots fill the hidden 「website」 field; pretend success and store nothing.
    if (typeof body.website === 'string' && body.website.trim()) return c.json({ ok: true, id: rid('FS-') });
    if (typeof body.elapsed !== 'number' || body.elapsed < MIN_FILL_MS) return c.json({ error: 'too_fast', message: '提交过快，请检查后再提交' }, 400);
    if (!perIp(clientIp(c)) || !global('all')) return c.json({ error: 'too_many_requests', message: '提交过于频繁，请稍后再试' }, 429);
    const { errors, values } = validateAnswers(form.questions, body.answers as Record<string, unknown>);
    if (Object.keys(errors).length) return c.json({ error: 'invalid', message: '请检查标红的题目', errors }, 400);
    const answers = snapshotAnswers(form.questions, values);
    const who = identityOf(answers);
    const id = rid('FS-');
    await repo.addSubmission({ id, formId: form.id, formVersion: form.version, answers, name: who.name.slice(0, 120), phone: who.phone.slice(0, 40), status: '待分配', program: null, team: null, studentId: null, assignedBy: null, assignedAt: null, note: '', createdAt: new Date().toISOString(), ip: clientIp(c).slice(0, 64), userAgent: (c.req.header('user-agent') || '').slice(0, 300) });
    return c.json({ ok: true, id }, 201);
  });
}

type SessionLike = { id: number; name: string; role: Role };
export function registerFormRoutes(app: AnyApp, repo: FormRepo) {
  const deny = (c: Context) => c.json({ error: 'forbidden', message: '收集表单仅超级管理员可用' }, 403);
  const guard = (c: Context) => { const u = c.get('user') as SessionLike | undefined; return u && canManageSystem(u.role) ? u : null; };

  app.get('/admin/forms', async c => {
    if (!guard(c)) return deny(c);
    const [forms, subs] = await Promise.all([repo.forms(), repo.submissions()]);
    return c.json({ forms: forms.map(f => ({ ...f, counts: { total: subs.filter(x => x.formId === f.id).length, pending: subs.filter(x => x.formId === f.id && x.status === '待分配').length } })) });
  });
  app.post('/admin/forms', async c => {
    if (!guard(c)) return deny(c);
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const base: FormDef = body.template === 'blank'
      ? { id: rid('F-'), slug: newSlug(), title: '未命名表单', titleEn: '', intro: '', introEn: '', open: false, version: 1, questions: [] }
      : { id: rid('F-'), slug: newSlug(), ...structuredClone(DEFAULT_FORM), open: false, version: 1 };
    try { return c.json({ form: await repo.saveForm(cleanForm({ ...body, slug: body.slug ?? base.slug }, base), true) }, 201); }
    catch (e) { return c.json({ error: 'invalid', message: (e as Error).message }, 400); }
  });
  app.put('/admin/forms/:id', async c => {
    if (!guard(c)) return deny(c);
    const current = await repo.form(c.req.param('id'));
    if (!current) return c.json({ error: 'not_found' }, 404);
    let next: FormDef;
    try { next = cleanForm(await c.req.json().catch(() => ({})), current); } catch (e) { return c.json({ error: 'invalid', message: (e as Error).message }, 400); }
    if (next.slug !== current.slug) { const other = await repo.formBySlug(next.slug); if (other && other.id !== current.id) return c.json({ error: 'conflict', message: '该链接标识已被其他表单使用' }, 409); }
    return c.json({ form: await repo.saveForm(next, false) });
  });
  app.delete('/admin/forms/:id', async c => {
    if (!guard(c)) return deny(c);
    const id = c.req.param('id');
    if ((await repo.submissions(id)).length) return c.json({ error: 'conflict', message: '该表单已有填写记录，请先关闭收集而不是删除' }, 409);
    await repo.deleteForm(id);
    return c.json({ ok: true });
  });
  app.get('/admin/forms/:id/submissions', async c => {
    if (!guard(c)) return deny(c);
    return c.json({ submissions: await repo.submissions(c.req.param('id')) });
  });
  app.get('/admin/form-submissions/:id/duplicates', async c => {
    if (!guard(c)) return deny(c);
    const sub = await repo.submission(c.req.param('id'));
    if (!sub) return c.json({ error: 'not_found' }, 404);
    return c.json({ duplicates: findDuplicates(sub, await repo.students()) });
  });
  app.patch('/admin/form-submissions/:id', async c => {
    if (!guard(c)) return deny(c);
    const body = await c.req.json().catch(() => null) as { status?: unknown; note?: unknown } | null;
    const patch: Partial<Submission> = {};
    if (body?.status !== undefined) {
      if (!isSubmissionStatus(body.status) || body.status === '已分配') return c.json({ error: 'invalid', message: '状态只能改为待分配或已忽略（分配请使用「分配到队伍」）' }, 400);
      patch.status = body.status as SubmissionStatus;
    }
    if (typeof body?.note === 'string') patch.note = body.note.trim().slice(0, 2000);
    const sub = await repo.submission(c.req.param('id'));
    if (!sub) return c.json({ error: 'not_found' }, 404);
    if (sub.status === '已分配' && patch.status) return c.json({ error: 'invalid', message: '已分配的记录不能改状态' }, 400);
    return c.json({ submission: await repo.updateSubmission(sub.id, patch) });
  });
  app.delete('/admin/form-submissions/:id', async c => {
    if (!guard(c)) return deny(c);
    const sub = await repo.submission(c.req.param('id'));
    if (!sub) return c.json({ error: 'not_found' }, 404);
    await repo.deleteSubmission(sub.id);
    return c.json({ ok: true });
  });
  /**
   * 队伍绑定分发. Body: { ids, team, sales?, links?: { [submissionId]: studentId | 'new' } }.
   * A submission whose name/phone matches an existing student needs an explicit link decision → 409 { duplicates }.
   */
  app.post('/admin/form-submissions/assign', async c => {
    const user = guard(c);
    if (!user) return deny(c);
    const body = await c.req.json().catch(() => null) as { ids?: unknown; team?: unknown; sales?: unknown; links?: unknown } | null;
    const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.filter((x): x is string => typeof x === 'string'))].slice(0, 200) : [];
    if (!ids.length) return c.json({ error: 'invalid', message: '请选择要分配的记录' }, 400);
    const team = typeof body?.team === 'string' ? await repo.team(body.team) : null;
    if (!team) return c.json({ error: 'invalid', message: '请选择项目与队伍' }, 400);
    const links = (body?.links && typeof body.links === 'object' ? body.links : {}) as Record<string, unknown>;
    const sales = s(body?.sales, 80);
    const subs: Submission[] = [];
    for (const id of ids) { const x = await repo.submission(id); if (!x) return c.json({ error: 'not_found', message: '记录不存在：' + id }, 404); subs.push(x); }
    let students = await repo.students();
    const duplicates: Record<string, ReturnType<typeof findDuplicates>> = {};
    for (const sub of subs) {
      if (links[sub.id] !== undefined) continue;
      const m = findDuplicates(sub, students).filter(d => d.strength !== 'name');
      if (m.length) duplicates[sub.id] = m;
    }
    if (Object.keys(duplicates).length) return c.json({ error: 'duplicates', message: '发现可能重复的学生，请选择关联已有学生或新建', duplicates }, 409);
    const results: { submission: string; student: string; created: boolean }[] = [];
    for (const sub of subs) {
      const link = links[sub.id];
      const linkTo = typeof link === 'string' && link !== 'new' ? link : sub.studentId && sub.status === '已分配' ? sub.studentId : null;
      if (linkTo && !students.some(x => x.id === linkTo)) return c.json({ error: 'invalid', message: '要关联的学生不存在' }, 400);
      const plan = planAssignment(sub, { program: team.program, team: team.id, sales }, { students, enrollments: await repo.enrollments(), linkTo, by: user.name, stamp: shanghaiStamp(new Date()), newId: 'S-' + Date.now().toString(36).toUpperCase() + randomBytes(2).toString('hex').toUpperCase() });
      await repo.applyAssignment(plan, sub.id, { status: '已分配', program: team.program, team: team.id, studentId: plan.student.id, assignedBy: user.name, assignedAt: new Date().toISOString() }, user);
      students = plan.created ? [...students, plan.student] : students.map(x => x.id === plan.student.id ? plan.student : x);
      results.push({ submission: sub.id, student: plan.student.id, created: plan.created });
    }
    return c.json({ ok: true, results });
  });
}

// ---------------------------------------------------------------- PostgreSQL repo
type QRow = typeof schema.formQuestions.$inferSelect;
type FRow = typeof schema.forms.$inferSelect;
type SRow = typeof schema.formSubmissions.$inferSelect;
const toQuestion = (r: QRow): FormQuestion => ({ id: r.id.includes(':') ? r.id.split(':').slice(1).join(':') : r.id, type: r.type as FormQuestion['type'], labelZh: r.labelZh, labelEn: r.labelEn, helpZh: r.helpZh, helpEn: r.helpEn, placeholder: r.placeholder, required: r.required, options: r.options ?? [], requireAll: r.requireAll, mapTo: r.mapTo });
const toForm = (f: FRow, qs: QRow[]): FormDef => ({ id: f.id, slug: f.slug, title: f.title, titleEn: f.titleEn, intro: f.intro, introEn: f.introEn, open: f.open, version: f.version, questions: qs.filter(q => q.formId === f.id).sort((a, b) => a.sortOrder - b.sortOrder).map(toQuestion) });
const toSub = (r: SRow): Submission => ({ id: r.id, formId: r.formId, formVersion: r.formVersion, answers: r.answers, name: r.name, phone: r.phone, status: (isSubmissionStatus(r.status) ? r.status : '待分配'), program: r.program, team: r.team, studentId: r.studentId, assignedBy: r.assignedBy, assignedAt: r.assignedAt ? r.assignedAt.toISOString() : null, note: r.note, createdAt: r.createdAt.toISOString() });

export function drizzleFormRepo(db: Db): FormRepo {
  // Question ids are only unique per form; rows are stored as "<formId>:<questionId>".
  const qKey = (formId: string, id: string) => formId + ':' + id;
  const repo: FormRepo = {
    async forms() {
      const [fs, qs] = await Promise.all([db.select().from(schema.forms).orderBy(asc(schema.forms.sortOrder), asc(schema.forms.createdAt)), db.select().from(schema.formQuestions)]);
      return fs.map(f => toForm(f, qs));
    },
    async form(id) {
      const [f] = await db.select().from(schema.forms).where(eq(schema.forms.id, id)).limit(1);
      return f ? toForm(f, await db.select().from(schema.formQuestions).where(eq(schema.formQuestions.formId, id))) : null;
    },
    async formBySlug(slug) {
      const [f] = await db.select().from(schema.forms).where(eq(schema.forms.slug, slug)).limit(1);
      return f ? toForm(f, await db.select().from(schema.formQuestions).where(eq(schema.formQuestions.formId, f.id))) : null;
    },
    async saveForm(def, isNew) {
      await db.transaction(async tx => {
        const meta = { slug: def.slug, title: def.title, titleEn: def.titleEn, intro: def.intro, introEn: def.introEn, open: def.open, version: def.version, updatedAt: new Date() };
        if (isNew) { const [{ m }] = await tx.select({ m: max(schema.forms.sortOrder) }).from(schema.forms); await tx.insert(schema.forms).values({ id: def.id, ...meta, sortOrder: (m ?? 0) + 1 }); }
        else await tx.update(schema.forms).set(meta).where(eq(schema.forms.id, def.id));
        await tx.delete(schema.formQuestions).where(eq(schema.formQuestions.formId, def.id));
        if (def.questions.length) await tx.insert(schema.formQuestions).values(def.questions.map((q, i) => ({ id: qKey(def.id, q.id), formId: def.id, sortOrder: i, type: q.type, labelZh: q.labelZh, labelEn: q.labelEn, helpZh: q.helpZh, helpEn: q.helpEn, placeholder: q.placeholder, required: q.required, options: q.options, requireAll: q.requireAll, mapTo: q.mapTo })));
      });
      return (await repo.form(def.id))!;
    },
    async deleteForm(id) { await db.delete(schema.forms).where(eq(schema.forms.id, id)); },
    async submissions(formId) {
      const rows = formId ? await db.select().from(schema.formSubmissions).where(eq(schema.formSubmissions.formId, formId)).orderBy(desc(schema.formSubmissions.createdAt)) : await db.select().from(schema.formSubmissions).orderBy(desc(schema.formSubmissions.createdAt));
      return rows.map(toSub);
    },
    async submission(id) { const [r] = await db.select().from(schema.formSubmissions).where(eq(schema.formSubmissions.id, id)).limit(1); return r ? toSub(r) : null; },
    async addSubmission(x) {
      await db.insert(schema.formSubmissions).values({ id: x.id, formId: x.formId, formVersion: x.formVersion, answers: x.answers, name: x.name, phone: x.phone, status: x.status, note: '', ip: x.ip, userAgent: x.userAgent });
    },
    async updateSubmission(id, p) {
      const set: Partial<typeof schema.formSubmissions.$inferInsert> = { updatedAt: new Date() };
      if (p.status) set.status = p.status;
      if (p.note !== undefined) set.note = p.note;
      const [r] = await db.update(schema.formSubmissions).set(set).where(eq(schema.formSubmissions.id, id)).returning();
      return r ? toSub(r) : null;
    },
    async deleteSubmission(id) { await db.delete(schema.formSubmissions).where(eq(schema.formSubmissions.id, id)); },
    async students() {
      const rows = await db.select().from(schema.students);
      return rows.map(r => ({ id: r.id, name: r.name, program: r.program, team: r.team, status: r.status, sales: r.sales, updated: r.updated, grade: r.grade, health: r.health, healthNote: r.healthNote, healthUpdated: r.healthUpdated, healthBy: r.healthBy, profile: r.profile ?? {} }));
    },
    async enrollments() { return (await db.select().from(schema.enrollments)).map(r => ({ id: r.id, student: r.student, program: r.program, team: r.team, status: r.status })); },
    async team(id) { const [t] = await db.select({ id: schema.teams.id, program: schema.teams.program, name: schema.teams.name }).from(schema.teams).where(eq(schema.teams.id, id)).limit(1); return t ?? null; },
    async applyAssignment(plan, submissionId, p, by) {
      await db.transaction(async tx => {
        const st = plan.student, now = new Date();
        const values = { name: st.name, program: st.program, team: st.team, status: st.status, sales: st.sales, updated: st.updated, grade: st.grade, health: st.health, healthNote: st.healthNote, healthUpdated: st.healthUpdated, healthBy: st.healthBy, profile: st.profile ?? {}, updatedAt: now };
        if (plan.created) {
          const [{ m }] = await tx.select({ m: max(schema.students.sortOrder) }).from(schema.students);
          await tx.insert(schema.students).values({ id: st.id, ...values, healthChangedAt: now, healthChangedBy: by.id, sortOrder: (m ?? 0) + 1 });
          await tx.insert(schema.studentStatusHistory).values({ studentId: st.id, health: st.health, healthNote: st.healthNote, previousHealth: null, changedBy: by.id, changedByName: by.name, changedAt: now });
        } else await tx.update(schema.students).set(values).where(eq(schema.students.id, st.id));
        const e = plan.enrollment;
        if (plan.enrollmentCreated) {
          const [{ m }] = await tx.select({ m: max(schema.enrollments.sortOrder) }).from(schema.enrollments);
          await tx.insert(schema.enrollments).values({ ...e, sortOrder: (m ?? 0) + 1 }).onConflictDoUpdate({ target: schema.enrollments.id, set: { team: e.team, updatedAt: now } });
        } else await tx.update(schema.enrollments).set({ team: e.team, status: e.status, updatedAt: now }).where(eq(schema.enrollments.id, e.id));
        await tx.update(schema.formSubmissions).set({ status: p.status!, program: p.program ?? null, team: p.team ?? null, studentId: p.studentId ?? null, assignedBy: p.assignedBy ?? null, assignedAt: p.assignedAt ? new Date(p.assignedAt) : null, updatedAt: now }).where(eq(schema.formSubmissions.id, submissionId));
      });
    },
  };
  return repo;
}

/** Seed the 「各项竞赛报名学员信息收集表」 once (closed until a superadmin opens it). */
export async function seedDefaultForm(db: Db, log: (s: string) => void = console.log) {
  const existing = await db.select({ id: schema.forms.id }).from(schema.forms).limit(1);
  if (existing.length) return;
  const repo = drizzleFormRepo(db);
  const def: FormDef = { id: 'F-COMPETITION', slug: newSlug(), ...structuredClone(DEFAULT_FORM), open: true, version: 1 };
  await repo.saveForm(def, true);
  log(`seed: 收集表单 ${def.title} (/#/f/${def.slug})`);
}

/** In-memory FormRepo for tests (same semantics as the PostgreSQL repo). */
export function memoryFormRepo(seed: { forms?: FormDef[]; students?: StudentLike[]; enrollments?: EnrollmentLike[]; teams?: { id: string; program: string; name: string }[] } = {}) {
  const forms = new Map((seed.forms || []).map(f => [f.id, structuredClone(f)]));
  const subs = new Map<string, Submission>();
  const students = new Map((seed.students || []).map(s => [s.id, structuredClone(s)]));
  const enrollments = new Map((seed.enrollments || []).map(e => [e.id, structuredClone(e)]));
  const teams = seed.teams || [];
  const repo: FormRepo & { subs: typeof subs; studentMap: typeof students; enrollmentMap: typeof enrollments } = {
    subs, studentMap: students, enrollmentMap: enrollments,
    async forms() { return [...forms.values()].map(f => structuredClone(f)); },
    async form(id) { const f = forms.get(id); return f ? structuredClone(f) : null; },
    async formBySlug(slug) { const f = [...forms.values()].find(x => x.slug === slug); return f ? structuredClone(f) : null; },
    async saveForm(def) { forms.set(def.id, structuredClone(def)); return structuredClone(def); },
    async deleteForm(id) { forms.delete(id); },
    async submissions(formId) { return [...subs.values()].filter(x => !formId || x.formId === formId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(x => structuredClone(x)); },
    async submission(id) { const x = subs.get(id); return x ? structuredClone(x) : null; },
    async addSubmission(x) { const { ip: _ip, userAgent: _ua, ...rest } = x; void _ip; void _ua; subs.set(x.id, structuredClone(rest)); },
    async updateSubmission(id, p) { const x = subs.get(id); if (!x) return null; Object.assign(x, p); return structuredClone(x); },
    async deleteSubmission(id) { subs.delete(id); },
    async students() { return [...students.values()].map(x => structuredClone(x)); },
    async enrollments() { return [...enrollments.values()].map(x => structuredClone(x)); },
    async team(id) { return teams.find(t => t.id === id) ?? null; },
    async applyAssignment(plan, submissionId, p) {
      students.set(plan.student.id, structuredClone(plan.student));
      enrollments.set(plan.enrollment.id, structuredClone(plan.enrollment));
      const x = subs.get(submissionId); if (x) Object.assign(x, p);
    },
  };
  return repo;
}
