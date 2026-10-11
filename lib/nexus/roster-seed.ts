/**
 * Student / team / enrollment seed from the four 花名册 Excel workbooks.
 * Generated offline (scripts/roster-seed.json); Pages + server seed both consume this.
 * Deduped by name+program. See docs/roster-import-report.json for field map & counts.
 */
import type { Student, Team, Enrollment } from './data';
import raw from './roster-seed-data.json';

type Raw = {
  students: Student[];
  teams: Team[];
  enrollments: Enrollment[];
};

const data = raw as Raw;
export const rosterStudents: Student[] = data.students;
export const rosterTeams: Team[] = data.teams;
export const rosterEnrollments: Enrollment[] = data.enrollments;
