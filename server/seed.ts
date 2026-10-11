/**
 * Idempotent seed. Existing rows are never overwritten, so running it on every deploy is safe.
 * It only inserts reference data that the app needs to start empty-but-real:
 *   - the 运营部 staff accounts (scrypt hashes; must change password on first sign-in)
 *   - the public sales demo account (sales@nexus.demo)
 *   - the programme catalogue, one empty unpublished article per programme
 *   - 班级类型 / 教务津贴标准
 * Teams, students, schedules, feedback, todos, 项目, 课程 and 课时记录 are entered in the app.
 * Old demo rows in an existing database are left alone; remove them with `purge-demo` (see below).
 */
import { and, inArray, like, or, sql, eq } from 'drizzle-orm';
import type { Db } from './db';
import { schema } from './db';
import * as data from '../lib/nexus/data';
import { seedArticles } from '../lib/nexus/article-seed';
import { salesDemo } from '../lib/nexus/auth';
import { defaultClassTypes } from '../lib/nexus/ops';
import { staffSeed } from './staff-seed';
import { hashPassword } from './password';

const withOrder = <T extends object>(list: readonly T[]) => list.map((x, i) => ({ ...x, sortOrder: i }));

export async function seed(db: Db, log: (s: string) => void = console.log) {
  for (const a of staffSeed) {
    const res = await db.insert(schema.users).values({ email: a.email, username: a.username, name: a.name, role: a.role, salesName: null, passwordHash: a.passwordHash, mustChangePassword: true }).onConflictDoNothing().returning({ id: schema.users.id });
    if (res.length) log(`seed: user ${a.username} <${a.email}> (${a.role})`);
    // Existing rows from an earlier seed get their username once (never overwrites a username set by an admin).
    else await db.update(schema.users).set({ username: a.username }).where(and(eq(schema.users.email, a.email), sql`${schema.users.username} is null`, sql`not exists (select 1 from users x where lower(x.username) = lower(${a.username}))`));
  }
  const sales = await db.insert(schema.users).values({ email: salesDemo.email, name: salesDemo.name, role: 'sales', salesName: salesDemo.salesName, passwordHash: await hashPassword(salesDemo.password) }).onConflictDoNothing().returning({ id: schema.users.id });
  if (sales.length) log(`seed: user ${salesDemo.email} (sales demo)`);
  const steps: [string, () => Promise<unknown[]>][] = [
    ['programs', () => db.insert(schema.programs).values(withOrder(data.programs).map(p => ({ ...p, draft: p.draft ?? null }))).onConflictDoNothing().returning({ id: schema.programs.id })],
    ['articles', () => db.insert(schema.articles).values(seedArticles.map(a => ({ ...a }))).onConflictDoNothing().returning({ program: schema.articles.program })],
    ['class_types', () => db.insert(schema.classTypes).values(withOrder(defaultClassTypes)).onConflictDoNothing().returning({ id: schema.classTypes.id })],
  ];
  for (const [name, run] of steps) {
    const rows = await run();
    if (rows.length) log(`seed: ${name} +${rows.length}`);
  }
  const res = await db.execute(sql`select count(*)::int as n from users`);
  log(`seed: done (${(res.rows[0] as { n: number }).n} users)`);
}

/**
 * One-off cleanup for databases seeded by older builds: deletes the fictional demo records
 * (DEMO-* students and everything attached to them, sample teams T001–T014, sample schedule C1–C18,
 * sample files R1–R13, sample todos) and disables ops@nexus.demo. Real records are untouched.
 * Run explicitly: `node server-dist/index.mjs purge-demo`. Never runs on deploy.
 */
export async function purgeDemo(db: Db, log: (s: string) => void = console.log) {
  const teamIds = Array.from({ length: 14 }, (_, i) => `T${String(i + 1).padStart(3, '0')}`);
  const courseIds = Array.from({ length: 18 }, (_, i) => `C${i + 1}`);
  const resourceIds = Array.from({ length: 13 }, (_, i) => `R${i + 1}`);
  await db.transaction(async tx => {
    const demoStudent = like(schema.students.id, 'DEMO-%');
    const n = (r: { rowCount?: number | null }) => r.rowCount ?? 0;
    log(`purge: feedbacks -${n(await tx.delete(schema.feedbacks).where(or(like(schema.feedbacks.student, 'DEMO-%'), inArray(schema.feedbacks.id, ['F1', 'F2']))))}`);
    log(`purge: assignments -${n(await tx.delete(schema.assignments).where(like(schema.assignments.student, 'DEMO-%')))}`);
    log(`purge: enrollments -${n(await tx.delete(schema.enrollments).where(like(schema.enrollments.student, 'DEMO-%')))}`);
    log(`purge: status history -${n(await tx.delete(schema.studentStatusHistory).where(like(schema.studentStatusHistory.studentId, 'DEMO-%')))}`);
    log(`purge: students -${n(await tx.delete(schema.students).where(demoStudent))}`);
    log(`purge: courses -${n(await tx.delete(schema.courses).where(inArray(schema.courses.id, courseIds)))}`);
    log(`purge: teams -${n(await tx.delete(schema.teams).where(and(inArray(schema.teams.id, teamIds), sql`not exists (select 1 from students s where s.team = ${schema.teams.id})`)))}`);
    log(`purge: resources -${n(await tx.delete(schema.resources).where(inArray(schema.resources.id, resourceIds)))}`);
    log(`purge: todos -${n(await tx.delete(schema.todos).where(like(schema.todos.id, 'TODO-seed-%')))}`);
    await tx.update(schema.users).set({ active: false }).where(eq(schema.users.email, 'ops@nexus.demo'));
  });
  log('purge: done (ops@nexus.demo disabled)');
}
