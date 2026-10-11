/**
 * Writable collections exposed by the API. Each record keeps the exact shape the frontend uses
 * (lib/nexus/data.ts, students.ts), so the browser store can sync records without mapping.
 */
import { z } from 'zod';
import { schema } from './db';
import { healthLevels } from '../lib/nexus/students';
import { assignmentStatuses } from '../lib/nexus/students';

const id = z.string().min(1).max(80);
const s = (max = 200) => z.string().max(max);
export const recordSchemas = {
  programs: z.object({ id, name: s(), en: s(), short: s(40), type: s(40), color: s(20), description: s(1000), date: s(20), status: s(40), curriculum: s(5000), draft: s(5000).optional(), published: z.boolean() }),
  teams: z.object({ id, name: s(), program: id, teacher: s(80), stage: z.number().int().min(0).max(10), status: s(40), note: s(2000) }),
  students: z.object({ id, name: s(), program: id, team: s(80), status: s(40), sales: s(80), updated: s(40), grade: s(20), health: z.enum(healthLevels as unknown as [string, ...string[]]), healthNote: s(1000), healthUpdated: s(40), healthBy: s(80) }),
  enrollments: z.object({ id, student: id, program: id, team: s(80), status: s(40) }),
  courses: z.object({ id, name: s(), program: id, team: s(80), teacher: s(80), date: s(20), time: s(40), status: s(40) }),
  feedbacks: z.object({ id, student: id, course: s(80), content: s(4000), next: s(2000), visible: z.boolean(), date: s(20) }),
  resources: z.object({ id, program: id, name: s(), type: s(40), format: s(20), size: s(40), public: z.boolean(), file: s(200).optional() }),
  assignments: z.object({ id, student: id, program: id, title: s(), due: s(20), submitted: s(20).nullable(), status: z.enum(assignmentStatuses as unknown as [string, ...string[]]), score: z.number().int().min(0).max(100).nullable(), feedback: s(2000), teacher: s(80) }),
} as const;
export type CollectionName = keyof typeof recordSchemas;
export const tables = {
  programs: schema.programs, teams: schema.teams, students: schema.students, enrollments: schema.enrollments,
  courses: schema.courses, feedbacks: schema.feedbacks, resources: schema.resources, assignments: schema.assignments,
} as const;
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
