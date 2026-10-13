/**
 * 课程排课 (course sessions): weekly recurrence / manual dates, occurrences for 今日课程 · 本周课程,
 * and the layout model behind 「导出课表」. Runtime-import free so tests/schedule.mjs can load it alone.
 * Dates are calendar dates (YYYY-MM-DD) in Asia/Shanghai; arithmetic runs in UTC so it never drifts.
 */
export type CourseSession = {
  id: string; course: string; date: string; start: string; end: string;
  /** 教室 / 线上 for this session ('' = the course's default). */ location?: string;
};
/** Weekly rule: weekdays are 1 = 周一 … 7 = 周日. Ends after `count` sessions or on `until` (inclusive). */
export type WeeklyRule = { startDate: string; weekdays: readonly number[]; start: string; end: string; count?: number | null; until?: string | null };
export const MAX_SESSIONS = 200;
export const weekdayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
export const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z')) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
const toUtc = (d: string) => Date.parse(d + 'T00:00:00Z');
const fromUtc = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export const addDays = (d: string, n: number) => fromUtc(toUtc(d) + n * DAY);
/** 1 = Monday … 7 = Sunday. */
export const isoWeekday = (d: string) => { const w = new Date(toUtc(d)).getUTCDay(); return w === 0 ? 7 : w; };
/** Monday of the week containing `d`. */
export const mondayOf = (d: string) => addDays(d, 1 - isoWeekday(d));
/** The 7 dates (Mon–Sun) of the week containing `d`. */
export const weekOf = (d: string) => { const m = mondayOf(d); return Array.from({ length: 7 }, (_, i) => addDays(m, i)); };
const minutes = (t: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
export const toMinutes = minutes;
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
function timeIssue(start: string, end: string) {
  const a = minutes(start), b = minutes(end);
  if (Number.isNaN(a)) return '请填写开始时间';
  if (Number.isNaN(b)) return '请填写结束时间';
  if (b <= a) return '结束时间需晚于开始时间';
  return null;
}

/** Dates produced by a weekly rule, or the first problem with it. */
export function weeklyDates(rule: WeeklyRule): { dates: string[]; issue: string | null } {
  const days = [...new Set(rule.weekdays.map(Number))].filter(d => d >= 1 && d <= 7).sort();
  if (!isDate(rule.startDate)) return { dates: [], issue: '请选择开始日期' };
  if (!days.length) return { dates: [], issue: '请至少选择一个上课日（周一至周日）' };
  const t = timeIssue(rule.start, rule.end); if (t) return { dates: [], issue: t };
  const count = rule.count == null || (rule.count as unknown) === '' ? null : Number(rule.count);
  const until = rule.until || null;
  if (count == null && !until) return { dates: [], issue: '请填写上课次数或截止日期' };
  if (count != null && !(Number.isInteger(count) && count >= 1 && count <= MAX_SESSIONS)) return { dates: [], issue: `上课次数需在 1–${MAX_SESSIONS} 之间` };
  if (until != null && !isDate(until)) return { dates: [], issue: '截止日期格式不正确' };
  if (until && until < rule.startDate) return { dates: [], issue: '截止日期不能早于开始日期' };
  const out: string[] = [];
  const hardStop = addDays(rule.startDate, 366 * 3);
  for (let d = rule.startDate; d <= hardStop; d = addDays(d, 1)) {
    if (until && d > until) break;
    if (days.includes(isoWeekday(d))) out.push(d);
    if (count != null && out.length >= count) break;
    if (out.length >= MAX_SESSIONS) break;
  }
  if (!out.length) return { dates: [], issue: '所选日期范围内没有符合的上课日' };
  if (until && count == null && out.length >= MAX_SESSIONS && addDays(out[out.length - 1], 1) <= until) return { dates: out, issue: `单次最多排 ${MAX_SESSIONS} 节课，请缩短截止日期` };
  return { dates: out, issue: null };
}

export type ManualSlot = { date: string; start: string; end: string; location?: string };
/** First problem with a list of manually added sessions, or null. */
export function manualIssue(rows: readonly ManualSlot[]): string | null {
  if (!rows.length) return '请至少添加一节课';
  if (rows.length > MAX_SESSIONS) return `单次最多排 ${MAX_SESSIONS} 节课`;
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!isDate(r.date)) return `第 ${i + 1} 节：请选择日期`;
    const t = timeIssue(r.start, r.end); if (t) return `第 ${i + 1} 节：${t}`;
    const k = r.date + ' ' + r.start;
    if (seen.has(k)) return `第 ${i + 1} 节与前面的课时间重复（${r.date} ${r.start}）`;
    seen.add(k);
  }
  return null;
}
/** Session records for one course, sorted by date / start. */
export function buildSessions(course: string, slots: readonly ManualSlot[], newId: () => string): CourseSession[] {
  return slots.slice().sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .map(x => ({ id: newId(), course, date: x.date, start: x.start, end: x.end, location: (x.location || '').trim() }));
}
export const slotsFromRule = (rule: WeeklyRule, location = ''): ManualSlot[] => weeklyDates(rule).dates.map(date => ({ date, start: rule.start, end: rule.end, location }));

/** Minimal course shape (lib/nexus/data.ts Course). time is 'HH:MM–HH:MM'. */
export type CourseLike = { id: string; name: string; program: string; teacher: string; date: string; time: string; status: string; code?: string; location?: string; team?: string };
export type Occurrence<C extends CourseLike = CourseLike> = { key: string; course: C; session: CourseSession | null; date: string; start: string; end: string; location: string };
const splitTime = (time: string) => { const [a = '', b = ''] = String(time || '').split(/[–—~-]/).map(x => x.trim()); return { start: minutes(a) >= 0 ? a : '', end: minutes(b) >= 0 ? b : '' }; };
/** Every scheduled meeting: a course's sessions, or (courses without sessions) its single date/time. */
export function occurrences<C extends CourseLike>(courses: readonly C[], sessions: readonly CourseSession[]): Occurrence<C>[] {
  const by = new Map<string, CourseSession[]>();
  for (const x of sessions) { const l = by.get(x.course); if (l) l.push(x); else by.set(x.course, [x]); }
  const out: Occurrence<C>[] = [];
  for (const c of courses) {
    const list = by.get(c.id);
    if (list?.length) for (const x of list) out.push({ key: c.id + '@' + x.id, course: c, session: x, date: x.date, start: x.start, end: x.end, location: x.location || c.location || '' });
    else if (isDate(c.date)) { const t = splitTime(c.time); out.push({ key: c.id, course: c, session: null, date: c.date, start: t.start, end: t.end, location: c.location || '' }); }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.course.name.localeCompare(b.course.name));
}
export const onDate = <C extends CourseLike>(list: readonly Occurrence<C>[], d: string) => list.filter(o => o.date === d);
export const inWeek = <C extends CourseLike>(list: readonly Occurrence<C>[], d: string) => { const w = weekOf(d); return list.filter(o => o.date >= w[0] && o.date <= w[6]); };

// ---------- 导出课表 layout ----------
export const PALETTE = [
  { fill: '#EEE7FC', edge: '#7C4DDB', ink: '#3B1F7A' }, { fill: '#E3EFFD', edge: '#2F6FD8', ink: '#163E7D' },
  { fill: '#E1F5EC', edge: '#1F9D6B', ink: '#0F5A3C' }, { fill: '#FDEBDD', edge: '#E07A2B', ink: '#7A3A0B' },
  { fill: '#FCE4EE', edge: '#D2467F', ink: '#7A1C45' }, { fill: '#E2F4F8', edge: '#1C93AE', ink: '#0D5566' },
  { fill: '#FFF4D6', edge: '#C99A06', ink: '#6B5000' }, { fill: '#ECEAF7', edge: '#5B5FC7', ink: '#2C2F7A' },
  { fill: '#F1EDE6', edge: '#8A6D4B', ink: '#4A3824' }, { fill: '#E8F3DC', edge: '#5E9B2B', ink: '#2F5512' },
] as const;
export type TimetableBlock = { key: string; day: number; startMin: number; endMin: number; lane: number; lanes: number; color: number; code: string; title: string; teacher: string; location: string; time: string };
export type TimetableWeek = { monday: string; days: string[]; blocks: TimetableBlock[]; fromMin: number; toMin: number };
export type LegendItem = { color: number; code: string; title: string; teacher: string; count: number };
/** Course key → colour index: stable for the whole export (sorted by code / name). */
export function colorMap<C extends CourseLike>(list: readonly Occurrence<C>[]) {
  const keys = [...new Map(list.map(o => [o.course.id, (o.course.code || '') + ' ' + o.course.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  return new Map(keys.map(([id], i) => [id, i % PALETTE.length]));
}
/** Week grid model: blocks per day with lanes for overlaps; hour range covers every block (≥ 8 h, default 08–18). */
export function timetableWeek<C extends CourseLike>(list: readonly Occurrence<C>[], monday: string, colors: Map<string, number>): TimetableWeek {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const items = list.filter(o => o.date >= days[0] && o.date <= days[6] && minutes(o.start) >= 0)
    .map(o => { const s = minutes(o.start); const e = minutes(o.end) > s ? minutes(o.end) : s + 60; return { o, s, e, day: days.indexOf(o.date) }; });
  let from = 8 * 60, to = 18 * 60;
  for (const x of items) { from = Math.min(from, Math.floor(x.s / 60) * 60); to = Math.max(to, Math.ceil(x.e / 60) * 60); }
  if (to - from < 8 * 60) to = Math.min(24 * 60, from + 8 * 60);
  const blocks: TimetableBlock[] = [];
  for (let d = 0; d < 7; d++) {
    const day = items.filter(x => x.day === d).sort((a, b) => a.s - b.s || b.e - a.e);
    // Greedy lanes inside clusters of overlapping blocks.
    let cluster: { x: typeof day[number]; lane: number }[] = [], clusterEnd = -1;
    const flush = () => { const lanes = Math.max(1, ...cluster.map(c => c.lane + 1)); for (const c of cluster) blocks.push(block(c.x, d, c.lane, lanes)); cluster = []; };
    const block = (x: typeof day[number], dayIdx: number, lane: number, lanes: number): TimetableBlock => ({
      key: x.o.key, day: dayIdx, startMin: x.s, endMin: x.e, lane, lanes, color: colors.get(x.o.course.id) ?? 0,
      code: x.o.course.code || '', title: x.o.course.name, teacher: x.o.course.teacher, location: x.o.location || '', time: `${hhmm(x.s)}–${hhmm(x.e)}`,
    });
    for (const x of day) {
      if (cluster.length && x.s >= clusterEnd) flush();
      const used = new Set(cluster.filter(c => c.x.e > x.s).map(c => c.lane));
      let lane = 0; while (used.has(lane)) lane++;
      cluster.push({ x, lane }); clusterEnd = Math.max(clusterEnd, x.e);
    }
    if (cluster.length) flush();
  }
  return { monday, days, blocks, fromMin: from, toMin: to };
}
export function legend<C extends CourseLike>(list: readonly Occurrence<C>[], colors: Map<string, number>): LegendItem[] {
  const m = new Map<string, LegendItem>();
  for (const o of list) { const v = m.get(o.course.id) ?? { color: colors.get(o.course.id) ?? 0, code: o.course.code || '', title: o.course.name, teacher: o.course.teacher, count: 0 }; v.count++; m.set(o.course.id, v); }
  return [...m.values()].sort((a, b) => a.color - b.color || a.title.localeCompare(b.title));
}
/** Mondays of `weeks` consecutive weeks starting with the week of `from`. */
export const weekStarts = (from: string, weeks: number) => Array.from({ length: Math.max(1, Math.min(12, weeks)) }, (_, i) => addDays(mondayOf(from), i * 7));
/** 「2026年10月12日 – 10月18日」 */
export function weekRangeLabel(monday: string, weeks = 1) {
  const end = addDays(monday, weeks * 7 - 1);
  const [y, m, d] = monday.split('-').map(Number), [y2, m2, d2] = end.split('-').map(Number);
  return `${y}年${m}月${d}日 – ${y2 !== y ? y2 + '年' : ''}${m2}月${d2}日`;
}
/** 学期 label from a date: Aug–Jan → 秋季学期, Feb–Jul → 春季学期 (academic year in front). */
export function termLabel(d: string) {
  const [y, m] = d.split('-').map(Number);
  return m >= 8 ? `${y}–${y + 1} 秋季学期` : m === 1 ? `${y - 1}–${y} 秋季学期` : `${y - 1}–${y} 春季学期`;
}

// ---------- 课程编号 & 排课冲突 (shared by the 新建课程 form and the API) ----------
/** 课程编号 format: letters + digits, optional dash segments (WS2026017-1-22, COND02501-11A, BEST2025001). */
export const COURSE_CODE_RE = /^[A-Z]{2,6}\d{3,10}[A-Z]?(?:-[A-Z0-9]{1,6}){0,4}$/;
export const normalizeCourseCode = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, '').toUpperCase();
/** null when `code` is a well-formed 课程编号 not used by another timetable course ('' is allowed: the code is optional). */
export function courseCodeIssue(code: string, courses: readonly { id: string; code?: string | null }[], selfId = ''): string | null {
  const c = normalizeCourseCode(code);
  if (!c) return null;
  if (!COURSE_CODE_RE.test(c)) return `课程编号「${String(code).trim()}」格式不正确，应类似 WS2026017-1-22 或 COND02501-11A`;
  const dup = courses.find(x => x.id !== selfId && normalizeCourseCode(x.code) === c);
  if (dup) return `课程编号 ${c} 已被其他课程使用`;
  return null;
}
/**
 * Course code is required and must match an existing 课时记录课程编号 in the library (ops_courses).
 * Prefer this over inventing a new code at create/edit time.
 */
export function knownCourseCodeIssue(code: string, known: readonly { code?: string | null }[]): string | null {
  const c = normalizeCourseCode(code);
  if (!c) return '请选择课程编号';
  if (!known.some(x => normalizeCourseCode(x.code) === c)) return `课程编号「${String(code).trim()}」匹配不上 / 编号不存在，无法创建`;
  return null;
}
export type ConflictReason = 'teacher' | 'team' | 'room';
export const conflictReasonLabel: Record<ConflictReason, string> = { teacher: '同一老师', team: '同一队伍', room: '同一教室' };
export type ScheduleConflict = { key: string; courseId: string; courseName: string; code: string; teacher: string; date: string; start: string; end: string; location: string; reasons: ConflictReason[] };
type ConflictCourse = CourseLike;
const ONLINE = /^(线上|线上直播|线上课程|online|待定|待通知|—|-)$/i;
/** Room key for conflict checks: '' (never conflicts) for empty / generic online / TBD. */
export const roomKey = (v: unknown) => { const s = String(v ?? '').trim().toLowerCase().replace(/\s+/g, ''); return !s || ONLINE.test(s) ? '' : s; };
/**
 * Meetings of other courses that overlap any of `slots` and share the teacher, the team or the room.
 * Back-to-back meetings (end == start) do not conflict.
 */
export function scheduleConflicts<C extends ConflictCourse>(
  slots: readonly { date: string; start: string; end: string; location?: string | null }[],
  ctx: { courseId?: string; teacher: string; team?: string; location?: string | null },
  courses: readonly C[], sessions: readonly CourseSession[],
): ScheduleConflict[] {
  const teacher = String(ctx.teacher || '').trim(), team = String(ctx.team || '').trim();
  const out: ScheduleConflict[] = [];
  const others = occurrences(courses.filter(c => c.id !== ctx.courseId), sessions.filter(x => x.course !== ctx.courseId));
  for (const slot of slots) {
    const a = minutes(slot.start), b = minutes(slot.end);
    if (Number.isNaN(a) || Number.isNaN(b)) continue;
    const room = roomKey(slot.location || ctx.location);
    for (const o of others) {
      if (o.date !== slot.date) continue;
      const s = minutes(o.start), e = minutes(o.end) > s ? minutes(o.end) : s + 60;
      if (Number.isNaN(s) || !(s < b && a < e)) continue;
      const reasons: ConflictReason[] = [];
      if (teacher && String(o.course.teacher || '').trim() === teacher) reasons.push('teacher');
      if (team && String(o.course.team || '').trim() === team) reasons.push('team');
      if (room && roomKey(o.location) === room) reasons.push('room');
      if (!reasons.length || out.some(x => x.key === o.key)) continue;
      out.push({ key: o.key, courseId: o.course.id, courseName: o.course.name, code: o.course.code || '', teacher: o.course.teacher, date: o.date, start: o.start, end: o.end, location: o.location, reasons });
    }
  }
  return out.sort((x, y) => x.date.localeCompare(y.date) || x.start.localeCompare(y.start));
}
export const conflictSummary = (list: readonly ScheduleConflict[], max = 3) =>
  list.slice(0, max).map(x => `${x.date} ${x.start}–${x.end} ${x.courseName}（${x.reasons.map(r => conflictReasonLabel[r]).join('、')}）`).join('；') + (list.length > max ? ` 等 ${list.length} 节` : '');
