/**
 * 课时记录 / 课情反馈 / 教务津贴 — pure helpers shared by the browser store, the API and tests.
 * No runtime imports, so tests/ops.mjs can transpile this file on its own.
 */
export type AllowanceUnit = 'hour' | 'person_hour' | 'session';
export const allowanceUnits: readonly { value: AllowanceUnit; label: string }[] = [
  { value: 'hour', label: '元/小时' },
  { value: 'person_hour', label: '元/人/小时' },
  { value: 'session', label: '元/次' },
];
export const unitLabel = (u: AllowanceUnit) => allowanceUnits.find(x => x.value === u)?.label ?? '元/小时';
export const isUnit = (v: unknown): v is AllowanceUnit => v === 'hour' || v === 'person_hour' || v === 'session';

/** 班级类型 + 教务津贴标准 (editable by superadmin). */
export type ClassType = { id: string; name: string; rate: number; unit: AllowanceUnit; note: string; active: boolean };
export type CourseStatus = '未开始' | '进行中' | '已结束';
export const courseStatuses: readonly CourseStatus[] = ['未开始', '进行中', '已结束'];
/** 项目 (项目编号 e.g. COND2025001). */
export type Project = { id: string; code: string; name: string; startDate: string; endDate: string; status: CourseStatus; note: string };
/** 课程 (课程编号 e.g. COND02501-11A), modelled on the lesson-record spreadsheet columns. */
export type OpsCourse = {
  id: string; code: string; project: string; name: string; status: CourseStatus; classType: string;
  /** 授课老师 (free text). */ teacher: string;
  /** 教务老师: email of one ops teacher. */ opsTeacher: string;
  startDate: string; endDate: string;
};
/** 授课老师 directory (系统管理 · 授课老师). Ops teachers are also selectable as 授课老师 via the staff list. */
export type Teacher = { id: string; name: string; note: string; active: boolean };
/** Names offered by the 授课老师 picker: active teachers + active ops staff, de-duplicated, keeping `current` selectable. */
export function teacherNames(teachers: readonly Teacher[], staff: readonly { name: string; active: boolean }[], current = ''): string[] {
  const out: string[] = [];
  const add = (n: string) => { const v = (n || '').trim(); if (v && !out.includes(v)) out.push(v); };
  staff.filter(u => u.active).forEach(u => add(u.name));
  teachers.filter(t => t.active).forEach(t => add(t.name));
  if (current) add(current);
  return out;
}
/** 'HH:MM' → minutes; NaN when malformed. */
export const timeToMinutes = (t: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
/** Validation for a 开始时间 / 结束时间 pair; null when valid. */
export function timeRangeIssue(start: string, end: string): string | null {
  const a = timeToMinutes(start), b = timeToMinutes(end);
  if (Number.isNaN(a)) return '请填写开始时间';
  if (Number.isNaN(b)) return '请填写结束时间';
  if (b <= a) return '结束时间需晚于开始时间';
  return null;
}
/** Human duration of a time range, e.g. 「1.5 小时」 / 「45 分钟」. */
export function durationLabel(start: string, end: string): string {
  const mins = timeToMinutes(end) - timeToMinutes(start);
  if (!(mins > 0)) return '';
  return mins % 60 === 0 ? `${mins / 60} 小时` : mins > 60 ? `${Math.round(mins / 6) / 10} 小时` : `${mins} 分钟`;
}
/** Label for a duration in minutes alone (新建课程 · 课时长度). */
export function minutesLabel(mins: number): string {
  if (!(mins > 0)) return '';
  return mins % 60 === 0 ? `${mins / 60} 小时` : mins > 60 ? `${Math.round(mins / 6) / 10} 小时` : `${mins} 分钟`;
}
/** HH:MM options every 15 minutes (腾讯会议-style), 00:00–23:45. */
export const TIME_OPTIONS_15: readonly string[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4), m = (i % 4) * 15;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});
/** Common 课时 lengths in minutes for 新建课程. */
export const DURATION_OPTIONS_MIN = [30, 45, 60, 90, 120, 150, 180] as const;
/** Snap a free-form HH:MM down to the nearest 15-minute slot (or '' if invalid). */
export function snapTo15(t: string): string {
  const m = timeToMinutes(t);
  if (Number.isNaN(m)) return '';
  const snapped = Math.max(0, Math.min(23 * 60 + 45, Math.round(m / 15) * 15));
  return `${String(Math.floor(snapped / 60)).padStart(2, '0')}:${String(snapped % 60).padStart(2, '0')}`;
}
/** start + durationMinutes → HH:MM (caps at 23:59; returns '' when start is bad). */
export function endFromDuration(start: string, durationMinutes: number): string {
  const a = timeToMinutes(start);
  if (Number.isNaN(a) || !(durationMinutes > 0)) return '';
  const end = Math.min(a + durationMinutes, 23 * 60 + 59);
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}
/** Prefer an exact DURATION_OPTIONS_MIN match; otherwise the raw positive minute span (or 90 default). */
export function durationFromRange(start: string, end: string, fallback = 90): number {
  const mins = timeToMinutes(end) - timeToMinutes(start);
  if (!(mins > 0)) return fallback;
  if ((DURATION_OPTIONS_MIN as readonly number[]).includes(mins)) return mins;
  return mins;
}
/** One 课时记录. rate/unit are a snapshot of the class type when the record was created. */
export type LessonRecord = {
  id: string; course: string; date: string; hours: number;
  /** 应到人数: roster size of the course's team when the lesson was logged (see expectedAttendance); null = unknown. */
  expectedCount: number | null;
  /** 实到人数 (filled by ops); drives the 元/人/小时 allowance. Replaces the old `students` field. */
  actualCount: number | null;
  opsTeacher: string;
  rate: number; unit: AllowanceUnit; amount: number; note: string; createdBy: string;
  /** 授课老师 of this lesson (prefilled from the course; older records fall back to the course's teacher). */
  teacher?: string;
};
const countOrNull = (v: unknown): number | null => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; };
/**
 * Migrate a stored / API lesson to the current shape: the legacy `students` head count becomes
 * `actualCount` (实到人数); `expectedCount` defaults to null. Idempotent.
 */
export function normalizeLesson<T extends Partial<LessonRecord> & { students?: unknown }>(r: T): LessonRecord {
  const { students, ...rest } = r;
  return { ...rest, expectedCount: countOrNull(rest.expectedCount), actualCount: rest.actualCount !== undefined ? countOrNull(rest.actualCount) : countOrNull(students) } as LessonRecord;
}

/** Inputs for 应到人数: roster data from the store (schedule courses, teams, enrollments, students, class types). */
export type RosterContext = {
  courses?: readonly { code?: string; team: string }[];
  teams: readonly { id: string; name: string; program: string }[];
  enrollments: readonly { student: string; team: string; status: string }[];
  students: readonly { id: string; team: string; status: string }[];
  classTypes?: readonly { id: string; name: string }[];
};
export type ExpectedAttendance = { count: number | null; source: 'schedule' | 'team' | 'classType' | 'unknown'; teams: string[]; hint: string };
const INACTIVE = /退费|退班|退出|已退|取消|流失/;
/** Core of a team name: 「TEAM 「云驿」」 → 云驿 (TEAM prefix, brackets and spaces removed). */
export const teamCore = (name: string) => String(name || '').replace(/team/gi, '').replace(/[「」『』"“”\s]/g, '').trim();
/** Programme keyword in a course name (康莱德 → conrad …); '' when none. */
export function programOfCourseName(name: string): string {
  const n = String(name || '').toLowerCase();
  if (/康莱德|conrad|cond/.test(n)) return 'conrad';
  if (/bpa/.test(n)) return 'bpa';
  if (/ctb/.test(n)) return 'ctb';
  if (/ihosa/.test(n)) return 'ihosa';
  if (/mvp/.test(n)) return 'mvp';
  return '';
}
/** Teams a 课时记录 course belongs to: the timetable course with the same 课程编号, else the team named after 「TEAM」 in the course name. */
export function courseTeams(course: { code: string; name: string }, ctx: RosterContext): { ids: string[]; via: 'schedule' | 'team' | null } {
  const sched = (ctx.courses || []).filter(c => c.code && c.team && c.code.trim().toLowerCase() === course.code.trim().toLowerCase()).map(c => c.team);
  const known = sched.filter(id => ctx.teams.some(t => t.id === id));
  if (known.length) return { ids: [...new Set(known)], via: 'schedule' };
  const m = /team(.*)$/i.exec(course.name || '');
  if (!m) return { ids: [], via: null };
  const tail = teamCore(m[1]);
  const program = programOfCourseName(course.name);
  let best = 0; let ids: string[] = [];
  for (const t of ctx.teams) {
    if (program && t.program !== program) continue;
    const core = teamCore(t.name);
    if (core.length < 1 || !tail.startsWith(core)) continue;
    if (core.length > best) { best = core.length; ids = [t.id]; } else if (core.length === best) ids.push(t.id);
  }
  return { ids, via: ids.length ? 'team' : null };
}
/**
 * 授课老师 name aliases (花名册 / 课程表 spelling vs login account).
 * Match both directions so ACL and rematch stay consistent.
 */
export const TEACHER_NAME_ALIASES: Readonly<Record<string, string>> = {
  '郝震焜': '郝震昆',
};
/** Canonical display / match key for a 授课老师 name. */
export function canonicalTeacherName(name: unknown): string {
  const n = String(name || '').normalize('NFKC').trim();
  return TEACHER_NAME_ALIASES[n] || n;
}
/** True when two 授课老师 labels refer to the same person (exact, alias, or containment). */
export function sameTeacherName(a: unknown, b: unknown): boolean {
  const x = canonicalTeacherName(a), y = canonicalTeacherName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}
export type TeacherScopeInput<
  OC extends { id: string; code: string; name: string; teacher: string } = { id: string; code: string; name: string; teacher: string },
  C extends { id: string; teacher: string; team: string; code?: string } = { id: string; teacher: string; team: string; code?: string },
  T extends { id: string; name: string; program: string; teacher?: string } = { id: string; name: string; program: string; teacher?: string },
> = {
  opsCourses: readonly OC[];
  courses?: readonly C[];
  teams: readonly T[];
  enrollments: readonly { id?: string; student: string; team: string; status: string }[];
  students: readonly { id: string; team: string; status: string }[];
};
/**
 * Coach portal roster scope derived from existing data (no invented assignments):
 * 1. Prefer operational `teams.teacher` when it already names this coach;
 * 2. Plus teams linked from their ops 课程编号 via courseTeams (TEAM … in course name / schedule code);
 * 3. Plus teams on 课程安排 rows where they are 授课老师;
 * 4. Students = enrollments ∪ students.team for those team ids.
 */
export function teacherRosterScope<
  OC extends { id: string; code: string; name: string; teacher: string },
  C extends { id: string; teacher: string; team: string; code?: string },
  T extends { id: string; name: string; program: string; teacher?: string },
>(teacherName: string, input: TeacherScopeInput<OC, C, T>) {
  const name = canonicalTeacherName(teacherName);
  const mineOps = input.opsCourses.filter(c => sameTeacherName(c.teacher, name));
  const mineCourses = (input.courses || []).filter(c => sameTeacherName(c.teacher, name));
  const teamIds = new Set<string>();
  for (const t of input.teams) if (sameTeacherName(t.teacher, name)) teamIds.add(t.id);
  const ctx: RosterContext = {
    courses: input.courses, teams: input.teams, enrollments: input.enrollments, students: input.students,
  };
  for (const c of mineOps) for (const id of courseTeams(c, ctx).ids) teamIds.add(id);
  for (const c of mineCourses) if (c.team) teamIds.add(c.team);
  const studentIds = new Set<string>();
  for (const e of input.enrollments) if (teamIds.has(e.team)) studentIds.add(e.student);
  for (const s of input.students) if (teamIds.has(s.team)) studentIds.add(s.id);
  return {
    name,
    opsCourses: mineOps,
    courses: mineCourses,
    teamIds,
    studentIds,
    opsCourseIds: new Set(mineOps.map(c => c.id)),
    courseIds: new Set(mineCourses.map(c => c.id)),
  };
}
/** Fixed class size from a class type name (「线下8人班型」 → 8); ranges / 「及以上」 → null. */
export function classTypeSize(name: string): number | null {
  const n = String(name || '');
  if (/\d+\s*-\s*\d+\s*人|及以上|以上/.test(n)) return null;
  const m = /(\d+)\s*人班/.exec(n);
  return m ? Number(m[1]) : null;
}
/**
 * 应到人数 for a 课时记录 course:
 * 1. the course's team roster — distinct active students enrolled in the team(s) (enrollments ∪ students.team),
 *    team found via the timetable course with the same 课程编号, else the 「TEAM xx」 in the course name;
 * 2. else the class type's fixed size (「线下8人班型」 → 8);
 * 3. else unknown (null) — the form shows 「—」 with a hint.
 */
export function expectedAttendance(course: { code: string; name: string; classType: string } | undefined, ctx: RosterContext): ExpectedAttendance {
  if (!course) return { count: null, source: 'unknown', teams: [], hint: '请先选择课程' };
  const { ids, via } = courseTeams(course, ctx);
  if (ids.length) {
    const set = new Set(ids), seen = new Set<string>();
    for (const e of ctx.enrollments) if (set.has(e.team) && !INACTIVE.test(e.status || '')) seen.add(e.student);
    for (const st of ctx.students) if (set.has(st.team) && !INACTIVE.test(st.status || '')) seen.add(st.id);
    const names = ids.map(id => ctx.teams.find(t => t.id === id)?.name || id);
    if (seen.size) return { count: seen.size, source: via === 'schedule' ? 'schedule' : 'team', teams: names, hint: `按队伍名单：${names.join('、')}` };
  }
  const type = (ctx.classTypes || []).find(t => t.id === course.classType);
  const size = type ? classTypeSize(type.name) : null;
  if (size) return { count: size, source: 'classType', teams: [], hint: `按班型人数：${type!.name}` };
  return { count: null, source: 'unknown', teams: [], hint: '未匹配到队伍名单，请直接填写实到人数' };
}
/** 到课情况 text from 实到 / 应到: 「5/6 到课」, 「6/6 全勤」, 「5 人到课」. */
export function attendanceText(actual: number | null, expected: number | null): string {
  if (actual == null) return '';
  if (expected && expected > 0) return actual === expected ? `${actual}/${expected} 全勤` : `${actual}/${expected} 到课`;
  return `${actual} 人到课`;
}

/** First contiguous digit run after stripping a leading letter/hyphen prefix (COND2025001 → 2025001, WS2026017-11 → 2026017). */
export function codePrimaryNumeric(code: string): number {
  const m = String(code || '').trim().replace(/^[A-Za-z-]+/, '').match(/^\d+/);
  return m ? Number(m[0]) : 0;
}
/** Last contiguous digit run (WS2026017-11 → 11). */
export function codeTrailingNumeric(code: string): number {
  const m = String(code || '').match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
}
/** Sort 项目/课程编号 by trailing numeric suffixes ascending (primary run, then final segment, then locale). */
export function compareByCodeNumeric(a: string, b: string): number {
  const pa = codePrimaryNumeric(a), pb = codePrimaryNumeric(b);
  if (pa !== pb) return pa - pb;
  const ta = codeTrailingNumeric(a), tb = codeTrailingNumeric(b);
  if (ta !== tb) return ta - tb;
  return a.localeCompare(b, 'en');
}

/** Live filter for the course combobox: every whitespace-separated term must match code, name, project or teacher. */
export function filterCourses<T extends { code: string; name: string; teacher: string; project: string }>(courses: readonly T[], query: string, projectLabel: (id: string) => string = () => ''): T[] {
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return courses.slice();
  const scored: { c: T; score: number; i: number }[] = [];
  courses.forEach((c, i) => {
    const code = c.code.toLowerCase(), hay = [code, c.name, projectLabel(c.project), c.teacher].join(' ').toLowerCase();
    if (!terms.every(t => hay.includes(t))) return;
    // Code prefix matches first, then code contains, then anything else; stable otherwise.
    const q = terms[0];
    scored.push({ c, i, score: code.startsWith(q) ? 0 : code.includes(q) ? 1 : 2 });
  });
  return scored.sort((a, b) => a.score - b.score || a.i - b.i).map(x => x.c);
}

/** One 课情反馈, optionally linked to a 课时记录. */
export type LessonFeedback = {
  id: string; course: string; lesson: string | null; date: string; attendance: string; content: string;
  performance: string; issues: string; nextSteps: string; opsTeacher: string; createdBy: string;
};

/**
 * Seeded from the 教务津贴标准 table. Items 1–6 carry explicit units. The rest have no unit in the
 * source table and default to 元/小时 (线下6/7/8/11人班型 = ¥5 × class size per hour, consistent with
 * item 6); superadmins can change any unit in 系统管理.
 */
export const defaultClassTypes: readonly ClassType[] = [
  { id: 'CT01', name: '1. 线上1-2人班型', rate: 10, unit: 'hour', note: '10元/小时', active: true },
  { id: 'CT02', name: '2. 线上3-5人班型', rate: 15, unit: 'hour', note: '15元/小时', active: true },
  { id: 'CT03', name: '3. 线上6人及以上班型', rate: 3, unit: 'person_hour', note: '3元/人/小时', active: true },
  { id: 'CT04', name: '4. 线下1-2人班型', rate: 15, unit: 'hour', note: '15元/小时', active: true },
  { id: 'CT05', name: '5. 线下3-5人班型', rate: 25, unit: 'hour', note: '25元/小时', active: true },
  { id: 'CT06', name: '6. 线下6人及以上班型', rate: 5, unit: 'person_hour', note: '5元/人/小时', active: true },
  { id: 'CT07', name: '7. 部分教务工作2', rate: 2, unit: 'hour', note: '线上前期筹备工作（单位待确认，默认按小时）', active: true },
  { id: 'CT08', name: '8. 部分教务工作3', rate: 3, unit: 'hour', note: '线下跟课工作（单位待确认，默认按小时）', active: true },
  { id: 'CT09', name: '线下8人班型', rate: 40, unit: 'hour', note: '单位待确认，默认按小时', active: true },
  { id: 'CT10', name: '线下7人班型', rate: 35, unit: 'hour', note: '单位待确认，默认按小时', active: true },
  { id: 'CT11', name: '线下11人班型', rate: 55, unit: 'hour', note: '单位待确认，默认按小时', active: true },
  { id: 'CT12', name: '线下6人班型', rate: 30, unit: 'hour', note: '单位待确认，默认按小时', active: true },
];

const round2 = (n: number) => Math.round(n * 100) / 100;
/** 教务津贴 for one record: 元/小时 × 小时；元/人/小时 × 人数 × 小时；元/次 × 1. */
export function computeAllowance(rate: number, unit: AllowanceUnit, hours: number, students?: number | null): number {
  const r = Number(rate) || 0, h = Math.max(0, Number(hours) || 0), n = Math.max(0, Number(students) || 0);
  if (unit === 'person_hour') return round2(r * n * h);
  if (unit === 'session') return round2(r);
  return round2(r * h);
}
export const needsStudents = (unit: AllowanceUnit) => unit === 'person_hour';
export const money2 = (n: number) => '¥' + (Math.round(n * 100) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** YYYY-MM of a YYYY-MM-DD date. */
export const monthOf = (date: string) => (date || '').slice(0, 7);
/** Current month (YYYY-MM) in Asia/Shanghai. */
export function currentMonth(now = new Date(), timeZone = 'Asia/Shanghai') {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now);
  return `${p.find(x => x.type === 'year')?.value}-${p.find(x => x.type === 'month')?.value}`;
}
/** Today (YYYY-MM-DD) in Asia/Shanghai. */
export function today(now = new Date(), timeZone = 'Asia/Shanghai') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export const monthLabel = (ym: string) => { const [y, m] = ym.split('-'); return y && m ? `${y}年${Number(m)}月` : ym; };

/** ¥/hour for 「我的课时费用」 when the ops teacher is 授课老师 (本人授课) that month. */
export const LESSON_TEACHING_FEE_PER_HOUR = 150;
/** ¥ earned per full 24h of workbench usage (「本月红包提现」). */
export const RED_PACKET_YUAN_PER_DAY = 2.4;
const MS_PER_DAY = 24 * 3600_000;
/** YYYY-MM month key validation (same shape as KPI months). */
export const isLessonMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
/** Whether `dateOrMonth` (YYYY-MM or YYYY-MM-DD) falls in a confirmed/locked month. */
export function isLessonMonthLocked(locks: readonly string[], dateOrMonth: string) {
  const m = (dateOrMonth || '').length >= 7 ? (dateOrMonth || '').slice(0, 7) : '';
  return !!m && locks.includes(m);
}
/** 张捷嘉 (部门负责人) may still edit locked months; everyone else is frozen. */
export function canEditLockedLessonMonth(user: { name?: string | null; email?: string | null; leader?: boolean | null } | null | undefined) {
  if (!user) return false;
  if (user.leader === true) return true;
  if ((user.name || '').trim() === '张捷嘉') return true;
  return /^zhangjiejia@/i.test(user.email || '');
}
/**
 * Hours where 授课老师 === the logged-in ops teacher (本人授课).
 * Follow-class rows (教务老师 only / other 授课老师) do NOT count. month '' = all months.
 */
export function myTeachingLessonHours(
  records: readonly LessonRecord[],
  courses: readonly { id: string; teacher: string }[],
  teacherName: string,
  month = '',
) {
  const name = (teacherName || '').trim();
  if (!name) return 0;
  let hours = 0;
  for (const r of records) {
    if (month && monthOf(r.date) !== month) continue;
    if (!sameTeacherName(lessonTeacher(r, courses), name)) continue;
    hours += r.hours;
  }
  return round2(hours);
}
/** 「我的课时费用」: 本人授课 hours × ¥150 when hours > 0, else ¥0. */
export function myLessonTeachingFee(hours: number) {
  const h = Math.max(0, Number(hours) || 0);
  return h > 0 ? round2(h * LESSON_TEACHING_FEE_PER_HOUR) : 0;
}
/** 「本月红包提现」: usageMs / 24h × ¥2.4. */
export function redPacketFromUsageMs(ms: number) {
  const m = Math.max(0, Number(ms) || 0);
  return round2((m / MS_PER_DAY) * RED_PACKET_YUAN_PER_DAY);
}

/** Records the viewer may see: the 部门负责人 (leader flag) sees all, everyone else only their own. */
export function visibleLessons<T extends { opsTeacher: string }>(list: readonly T[], viewer: { role: unknown; leader?: boolean | null }, email: string): T[] {
  if (viewer && viewer.leader === true && (viewer.role === 'ops' || viewer.role === 'superadmin' || viewer.role === 'admin')) return list.slice();
  // Teacher portal bootstrap already scopes to the 授课老师's courses; show that list as-is.
  if (viewer && viewer.role === 'teacher') return list.slice();
  const me = (email || '').toLowerCase();
  return list.filter(r => r.opsTeacher.toLowerCase() === me);
}
export function monthAllowance(records: readonly LessonRecord[], email: string, month: string) {
  const me = email.toLowerCase();
  const mine = records.filter(r => r.opsTeacher.toLowerCase() === me && monthOf(r.date) === month);
  return { amount: round2(mine.reduce((n, r) => n + r.amount, 0)), hours: round2(mine.reduce((n, r) => n + r.hours, 0)), count: mine.length };
}
/** Per-teacher totals, highest amount first. */
export function summarizeByTeacher(records: readonly LessonRecord[]) {
  const map = new Map<string, { opsTeacher: string; amount: number; hours: number; count: number }>();
  for (const r of records) {
    const k = r.opsTeacher.toLowerCase();
    const v = map.get(k) ?? { opsTeacher: r.opsTeacher, amount: 0, hours: 0, count: 0 };
    v.amount = round2(v.amount + r.amount); v.hours = round2(v.hours + r.hours); v.count++;
    map.set(k, v);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount || a.opsTeacher.localeCompare(b.opsTeacher));
}

/** 授课老师 of a record: its own field, else the course's 授课老师, else 「未填写」. */
export function lessonTeacher(r: { teacher?: string; course: string }, courses: readonly { id: string; teacher: string }[]) {
  return (r.teacher || '').trim() || (courses.find(c => c.id === r.course)?.teacher || '').trim() || '未填写';
}
/** Hours per 授课老师 for one month (YYYY-MM; '' = all months), most hours first. */
export function hoursByLessonTeacher(records: readonly LessonRecord[], courses: readonly { id: string; teacher: string }[], month = '') {
  const map = new Map<string, { teacher: string; hours: number; count: number; amount: number }>();
  for (const r of records) {
    if (month && monthOf(r.date) !== month) continue;
    const t = lessonTeacher(r, courses);
    const v = map.get(t) ?? { teacher: t, hours: 0, count: 0, amount: 0 };
    v.hours = round2(v.hours + r.hours); v.count++; v.amount = round2(v.amount + r.amount);
    map.set(t, v);
  }
  return [...map.values()].sort((a, b) => b.hours - a.hours || a.teacher.localeCompare(b.teacher, 'zh-CN'));
}
/** 学情反馈 fields captured together with a 课时记录. */
export type FeedbackDraft = { attendance: string; content: string; performance: string; issues: string; nextSteps: string };
export const feedbackDraftEmpty = (d: FeedbackDraft) => !Object.values(d).some(v => (v || '').trim());
/**
 * 记录课时 + 学情反馈 in one form: returns the lesson record and, when any feedback field is filled
 * (and `withFeedback`), the linked 课情反馈 (same course / date / 教务老师, lesson = record id).
 * When editing a lesson that already has a linked feedback, pass it as `existing` to update it in place.
 */
export function lessonWithFeedback(input: {
  lesson: LessonRecord; feedback: FeedbackDraft; withFeedback: boolean; existing?: LessonFeedback | null; newId: () => string;
}): { lesson: LessonRecord; feedback: LessonFeedback | null; issue: string | null } {
  const { lesson, feedback: d, withFeedback, existing } = input;
  if (!withFeedback || feedbackDraftEmpty(d)) return { lesson, feedback: null, issue: null };
  if (!d.content.trim()) return { lesson, feedback: null, issue: '请填写学情反馈中的「本次课程内容」，或取消勾选「同时记录学情反馈」' };
  const feedback: LessonFeedback = {
    id: existing?.id || input.newId(), course: lesson.course, lesson: lesson.id, date: lesson.date,
    attendance: d.attendance.trim().slice(0, 200), content: d.content.trim(), performance: d.performance.trim(), issues: d.issues.trim(), nextSteps: d.nextSteps.trim(),
    opsTeacher: lesson.opsTeacher, createdBy: existing?.createdBy || lesson.createdBy,
  };
  return { lesson, feedback, issue: null };
}

/** Suggested course status from its dates. */
export function statusFromDates(start: string, end: string, day = today()): CourseStatus {
  if (start && day < start) return '未开始';
  if (end && day > end) return '已结束';
  return '进行中';
}

/** 2025年9月6日 / 2025/9/6 / 2025-09-06 / 2025.9.6 → 2025-09-06 ('' when unparseable). */
export function parseDate(v: string): string {
  const m = String(v || '').trim().match(/^(\d{4})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})\s*日?$/);
  if (!m) return '';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const normType = (s: string) => String(s || '').replace(/\s+/g, '').replace(/班型/g, '').replace(/[．。、]/g, '.');
const bareType = (s: string) => normType(s).replace(/^\d+\./, '');
/** Match a spreadsheet 班级类型 cell (e.g. "2. 线上3-5人") to a class type. */
export function matchClassType(cell: string, types: readonly ClassType[]): ClassType | undefined {
  const n = normType(cell), b = bareType(cell);
  if (!n) return undefined;
  return types.find(t => normType(t.name) === n) ?? types.find(t => bareType(t.name) === b);
}

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF, BOM, comma or tab separated). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = !firstLine.includes(',') && firstLine.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}
const csvCell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
/** CSV text with a BOM so Excel opens Chinese headers correctly. */
export const toCsv = (rows: readonly (readonly unknown[])[]) => '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

/** Columns of the lesson-record spreadsheet (attachment 3). 津贴标准 is derived from 班级类型. */
export const courseCsvColumns = ['项目编号', '课程编号', '课程状态', '课程名称', '班级类型', '津贴标准', '授课老师', '教务老师', '起始日期', '终止日期'] as const;
export type CsvIssue = { line: number; message: string };
export type CourseImport = { courses: OpsCourse[]; projects: Project[]; issues: CsvIssue[]; created: number; updated: number };

/**
 * Turn a pasted / uploaded course sheet into course records. Existing courses (same 课程编号) are
 * updated in place; unknown 项目编号 create a project; unknown 班级类型 or 教务老师 are reported.
 */
export function importCourses(text: string, ctx: {
  classTypes: readonly ClassType[]; projects: readonly Project[]; courses: readonly OpsCourse[];
  staff: readonly { email: string; name: string }[]; newId: (prefix: string) => string; today?: string;
}): CourseImport {
  const rows = parseCsv(text);
  const issues: CsvIssue[] = [];
  const out: CourseImport = { courses: [], projects: [], issues, created: 0, updated: 0 };
  if (!rows.length) { issues.push({ line: 1, message: '文件为空' }); return out; }
  const header = rows[0].map(h => h.trim());
  const col = (name: string) => header.indexOf(name);
  const missing = ['项目编号', '课程编号', '课程名称', '班级类型'].filter(n => col(n) < 0);
  if (missing.length) { issues.push({ line: 1, message: '缺少列：' + missing.join('、') }); return out; }
  const projects = [...ctx.projects];
  const seen = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (name: string) => { const k = col(name); return k < 0 ? '' : String(r[k] ?? '').trim(); };
    const code = get('课程编号'), projectCode = get('项目编号').toUpperCase(), name = get('课程名称');
    if (!code || !projectCode || !name) { issues.push({ line, message: '项目编号、课程编号、课程名称不能为空' }); return; }
    if (seen.has(code)) { issues.push({ line, message: `课程编号 ${code} 在文件中重复` }); return; }
    const type = matchClassType(get('班级类型'), ctx.classTypes);
    if (!type) { issues.push({ line, message: `未知班级类型「${get('班级类型')}」` }); return; }
    const opsName = get('教务老师');
    const ops = opsName ? ctx.staff.find(u => u.name === opsName || u.email.toLowerCase() === opsName.toLowerCase()) : undefined;
    if (opsName && !ops) { issues.push({ line, message: `未知教务老师「${opsName}」` }); return; }
    const startRaw = get('起始日期'), endRaw = get('终止日期');
    const startDate = parseDate(startRaw), endDate = parseDate(endRaw);
    if ((startRaw && !startDate) || (endRaw && !endDate)) { issues.push({ line, message: '日期格式无法识别（示例：2025年9月6日 或 2025-09-06）' }); return; }
    const statusCell = get('课程状态');
    const status = (courseStatuses as readonly string[]).includes(statusCell) ? statusCell as CourseStatus : statusFromDates(startDate, endDate, ctx.today);
    let project = projects.find(p => p.code.toUpperCase() === projectCode);
    if (!project) {
      project = { id: ctx.newId('P'), code: projectCode, name: projectCode, startDate, endDate, status, note: '由课程导入自动创建' };
      projects.push(project); out.projects.push(project);
    }
    const existing = ctx.courses.find(c => c.code === code);
    seen.add(code);
    const course: OpsCourse = { id: existing?.id ?? ctx.newId('OC'), code, project: project.id, name, status, classType: type.id, teacher: get('授课老师'), opsTeacher: ops?.email ?? existing?.opsTeacher ?? '', startDate, endDate };
    out.courses.push(course);
    if (existing) out.updated++; else out.created++;
  });
  return out;
}
export function newRecordId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
/**
 * 运营端「我的课程」: 课时课程 where I am the 授课老师 (name match) or the 运营老师 (login email);
 * 课程安排 courses where I am the 授课老师 or whose 课程编号 belongs to one of those 课时课程.
 * Used server-side (bootstrap) and client-side (useVisible / pickers). 系统管理 keeps the full list.
 */
export function opsOwnScope<
  OC extends { id: string; code: string; teacher: string; opsTeacher: string },
  C extends { id: string; teacher: string; code?: string | null },
>(me: { name?: string | null; email?: string | null }, opsCourses: readonly OC[], courses: readonly C[]) {
  const name = canonicalTeacherName(me.name || ''), email = String(me.email || '').trim().toLowerCase();
  const isMine = (teacher: unknown, ops?: unknown) => (!!name && canonicalTeacherName(teacher) === name) || (!!email && String(ops || '').trim().toLowerCase() === email);
  const mineOps = opsCourses.filter(c => isMine(c.teacher, c.opsTeacher));
  const codes = new Set(mineOps.map(c => String(c.code || '').replace(/\s+/g, '').toUpperCase()).filter(Boolean));
  const mineCourses = courses.filter(c => isMine(c.teacher) || (!!c.code && codes.has(String(c.code).replace(/\s+/g, '').toUpperCase())));
  return { opsCourses: mineOps, courses: mineCourses, opsCourseIds: new Set(mineOps.map(c => c.id)), courseIds: new Set(mineCourses.map(c => c.id)) };
}
