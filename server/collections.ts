/**
 * Writable collections exposed by the API. Each record keeps the exact shape the frontend uses
 * (lib/nexus/data.ts, students.ts), so the browser store can sync records without mapping.
 */
import { z } from 'zod';
import { schema } from './db';
import { healthLevels } from '../lib/nexus/students';
import { assignmentStatuses } from '../lib/nexus/students';
import { courseStatuses } from '../lib/nexus/ops';

const id = z.string().min(1).max(80);
const s = (max = 200) => z.string().max(max);
const date = z.string().max(20).regex(/^(\d{4}-\d{2}-\d{2})?$/);
const unit = z.enum(['hour', 'person_hour', 'session']);
const status = z.enum(courseStatuses as unknown as [string, ...string[]]);
export const recordSchemas = {
  programs: z.object({ id, name: s(), en: s(), short: s(40), type: s(40), color: s(20), description: s(1000), date: s(20), status: s(40), curriculum: s(5000), draft: s(5000).optional(), published: z.boolean() }),
  teams: z.object({ id, name: s(), program: id, teacher: s(80), stage: z.number().int().min(0).max(10), status: s(40), note: s(2000) }),
  students: z.object({ id, name: s(), program: id, team: s(80), status: s(40), sales: s(80), updated: s(40), grade: s(20), health: z.enum(healthLevels as unknown as [string, ...string[]]), healthNote: s(1000), healthUpdated: s(40), healthBy: s(80) }),
  enrollments: z.object({ id, student: id, program: id, team: s(80), status: s(40) }),
  courses: z.object({ id, name: s(), program: id, team: s(80), teacher: s(80), date: s(20), time: s(40), status: s(40) }),
  feedbacks: z.object({ id, student: id, course: s(80), content: s(4000), next: s(2000), visible: z.boolean(), date: s(20) }),
  resources: z.object({ id, program: id, name: s(), type: s(40), format: s(20), size: s(40), public: z.boolean(), file: s(200).optional() }),
  assignments: z.object({ id, student: id, program: id, title: s(), due: s(20), submitted: s(20).nullable(), status: z.enum(assignmentStatuses as unknown as [string, ...string[]]), score: z.number().int().min(0).max(100).nullable(), feedback: s(2000), teacher: s(80) }),
  classTypes: z.object({ id, name: s(80).min(1), rate: z.number().min(0).max(100000), unit: unit, note: s(200), active: z.boolean() }),
  projects: z.object({ id, code: s(40).min(1), name: s().min(1), startDate: date, endDate: date, status, note: s(1000) }),
  opsCourses: z.object({ id, code: s(60).min(1), project: id, name: s().min(1), status, classType: id, teacher: s(80), opsTeacher: s(120), startDate: date, endDate: date }),
  lessons: z.object({ id, course: id, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hours: z.number().positive().max(24), students: z.number().int().min(0).max(1000).nullable(), opsTeacher: s(120).min(3), rate: z.number().min(0), unit, amount: z.number().min(0), note: s(1000), createdBy: s(120) }),
  lessonFeedbacks: z.object({ id, course: id, lesson: s(80).nullable(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), attendance: s(200), content: s(4000), performance: s(4000), issues: s(4000), nextSteps: s(2000), opsTeacher: s(120).min(3), createdBy: s(120) }),
} as const;
export type CollectionName = keyof typeof recordSchemas;
export const tables = {
  programs: schema.programs, teams: schema.teams, students: schema.students, enrollments: schema.enrollments,
  courses: schema.courses, feedbacks: schema.feedbacks, resources: schema.resources, assignments: schema.assignments,
  classTypes: schema.classTypes, projects: schema.projects, opsCourses: schema.opsCourses, lessons: schema.lessonRecords, lessonFeedbacks: schema.lessonFeedbacks,
} as const;
/** 系统管理 data: written by superadmins only. */
export const systemCollections: readonly CollectionName[] = ['classTypes', 'projects', 'opsCourses'];
/** Per-teacher records: ops write their own, superadmins any; ops only read their own. */
export const ownedCollections: readonly CollectionName[] = ['lessons', 'lessonFeedbacks'];
/** Collections that accept DELETE. */
export const deletableCollections: readonly CollectionName[] = [...systemCollections, ...ownedCollections];
export const isCollection = (name: string): name is CollectionName => Object.hasOwn(recordSchemas, name);

/** Row → API record: keep only the public fields, turn optional NULLs into absent keys. */
export function toRecord(name: CollectionName, row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const shape = recordSchemas[name].shape as Record<string, z.ZodTypeAny>;
  for (const key of Object.keys(shape)) {
    const v = row[key];
    if (v === null && shape[key].isOptional() && !shape[key].isNullable()) continue;
    if (v !== undefined) out[key] = v;
  }
  return out;
}
