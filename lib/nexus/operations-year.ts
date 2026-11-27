import type { Enrollment, Student, Team } from './data';

export const CURRENT_OPERATIONS_YEAR = 2027;
export const LEGACY_OPERATIONS_YEAR = 2026;

export const teamYear = (team: Pick<Team, 'year'>) => team.year ?? LEGACY_OPERATIONS_YEAR;

export function studentsForYear(students: Student[], teams: Team[], enrollments: Enrollment[], year: number) {
  const yearsByTeam = new Map(teams.map(team => [team.id, teamYear(team)]));
  const intakeYears = new Map(students.map(student => [student.id, student.intakeYear ?? LEGACY_OPERATIONS_YEAR]));
  const yearsByStudent = new Map<string, Set<number>>();
  for (const enrollment of enrollments) {
    const enrolledYear = enrollment.team ? yearsByTeam.get(enrollment.team) : intakeYears.get(enrollment.student);
    if (enrolledYear === undefined) continue;
    const years = yearsByStudent.get(enrollment.student) ?? new Set<number>();
    years.add(enrolledYear);
    yearsByStudent.set(enrollment.student, years);
  }
  return students.filter(student => {
    const primaryTeamYear = yearsByTeam.get(student.team);
    const enrollmentYears = yearsByStudent.get(student.id);
    if (enrollmentYears?.has(year) || primaryTeamYear === year) return true;
    return !enrollmentYears && primaryTeamYear === undefined && (student.intakeYear ?? LEGACY_OPERATIONS_YEAR) === year;
  });
}
