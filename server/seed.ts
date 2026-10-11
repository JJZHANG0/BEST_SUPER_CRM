/**
 * Idempotent seed from the bundled demo data. Existing rows are never overwritten, so running
 * it on every deploy is safe: it only fills an empty database (or adds new demo records).
 */
import { sql } from 'drizzle-orm';
import type { Db } from './db';
import { schema } from './db';
import * as demo from '../lib/nexus/data';
import { seedArticles } from '../lib/nexus/article-seed';
import { seedAssignments } from '../lib/nexus/students';
import { demoAccounts } from '../lib/nexus/auth';
import { hashPassword } from './password';

const withOrder = <T extends object>(list: readonly T[]) => list.map((x, i) => ({ ...x, sortOrder: i }));

export async function seed(db: Db, log: (s: string) => void = console.log) {
  for (const a of demoAccounts) {
    const res = await db.insert(schema.users).values({ email: a.email, name: a.name, role: a.role, salesName: a.role === 'sales' ? `顾问 ${a.name}` : null, passwordHash: await hashPassword(a.password) }).onConflictDoNothing().returning({ id: schema.users.id });
    if (res.length) log(`seed: user ${a.email} (${a.role})`);
  }
  const teacherFor = (program: string) => demo.teams.find(t => t.program === program)?.teacher ?? '陈老师';
  const steps: [string, () => Promise<unknown[]>][] = [
    ['programs', () => db.insert(schema.programs).values(withOrder(demo.programs).map(p => ({ ...p, draft: p.draft ?? null }))).onConflictDoNothing().returning({ id: schema.programs.id })],
    ['teams', () => db.insert(schema.teams).values(withOrder(demo.teams)).onConflictDoNothing().returning({ id: schema.teams.id })],
    ['students', () => db.insert(schema.students).values(withOrder(demo.students)).onConflictDoNothing().returning({ id: schema.students.id })],
    ['enrollments', () => db.insert(schema.enrollments).values(withOrder(demo.enrollments)).onConflictDoNothing().returning({ id: schema.enrollments.id })],
    ['courses', () => db.insert(schema.courses).values(withOrder(demo.courses)).onConflictDoNothing().returning({ id: schema.courses.id })],
    ['feedbacks', () => db.insert(schema.feedbacks).values(withOrder(demo.feedbacks)).onConflictDoNothing().returning({ id: schema.feedbacks.id })],
    ['resources', () => db.insert(schema.resources).values(withOrder(demo.resources).map(r => ({ ...r, file: r.file ?? null }))).onConflictDoNothing().returning({ id: schema.resources.id })],
    ['assignments', () => db.insert(schema.assignments).values(withOrder(seedAssignments(demo.students, teacherFor))).onConflictDoNothing().returning({ id: schema.assignments.id })],
    ['articles', () => db.insert(schema.articles).values(seedArticles.map(a => ({ ...a }))).onConflictDoNothing().returning({ program: schema.articles.program })],
  ];
  for (const [name, run] of steps) {
    const rows = await run();
    if (rows.length) log(`seed: ${name} +${rows.length}`);
  }
  const res = await db.execute(sql`select count(*)::int as n from students`);
  log(`seed: done (${(res.rows[0] as { n: number }).n} students)`);
}
