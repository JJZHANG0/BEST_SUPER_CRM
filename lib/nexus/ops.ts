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
/** One 课时记录. rate/unit are a snapshot of the class type when the record was created. */
export type LessonRecord = {
  id: string; course: string; date: string; hours: number; students: number | null; opsTeacher: string;
  rate: number; unit: AllowanceUnit; amount: number; note: string; createdBy: string;
};
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

/** Records the given role may see: superadmin all, others only their own. */
export function visibleLessons<T extends { opsTeacher: string }>(list: readonly T[], role: unknown, email: string): T[] {
  if (role === 'superadmin') return list.slice();
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
