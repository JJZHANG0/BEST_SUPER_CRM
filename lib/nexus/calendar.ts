/**
 * Personal course-calendar ICS feed helpers (Apple Calendar / webcal).
 * Runtime-import free so tests/calendar.mjs can load it alone.
 * Dates/times are Asia/Shanghai wall clock (YYYY-MM-DD + HH:MM).
 */
import { opsOwnScope, teacherRosterScope, canonicalTeacherName } from './ops';
import { occurrences, type CourseLike, type CourseSession } from './schedule';
import { isOpsLike, isTeacher, type Role } from './roles';

export const CALENDAR_TZ = 'Asia/Shanghai';
export const CALENDAR_PROD_ID = '-//BEST项目资料库//Course Calendar//CN';
export const CALENDAR_HOST = 'bestcrm.cc';

/** URL-safe unguessable token (32 chars). */
export function newCalendarToken(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (const b of bytes) out += alphabet[b & 63];
  return out;
}

/** Accept tokens from path param (with or without .ics). */
export function normalizeCalendarToken(raw: string): string | null {
  const t = String(raw || '').trim().replace(/\.ics$/i, '');
  return /^[A-Za-z0-9_-]{20,64}$/.test(t) ? t : null;
}

export function isCancelledCourseStatus(status: unknown): boolean {
  const s = String(status || '').trim();
  return /取消|删除|已撤销|已作废/.test(s);
}

type OpsCourseLike = { id: string; code: string; teacher: string; opsTeacher: string };
type TeamLike = { id: string; name: string; teacher?: string };
type ProgramLike = { id: string; name: string; short?: string };

/**
 * Courses whose sessions appear on this user's personal feed —
 * same ownership as 课程管理 / useVisible (授课老师 or 运营老师).
 * Sales: none. Teacher portal role: 授课老师 by name. Ops-like: opsOwnScope.
 */
export function coursesForCalendarOwner<
  OC extends OpsCourseLike,
  C extends CourseLike & { code?: string | null; team?: string },
  T extends TeamLike,
>(
  me: { name?: string | null; email?: string | null; role: Role },
  input: { opsCourses: readonly OC[]; courses: readonly C[]; teams?: readonly T[]; enrollments?: readonly { student: string; team: string; status: string }[]; students?: readonly { id: string; team: string; status: string }[] },
): C[] {
  if (me.role === 'sales') return [];
  const active = input.courses.filter(c => !isCancelledCourseStatus(c.status));
  if (isTeacher(me.role)) {
    const scope = teacherRosterScope(me.name || '', {
      opsCourses: input.opsCourses as unknown as { id: string; code: string; name: string; teacher: string }[],
      courses: active as unknown as { id: string; teacher: string; team: string; code?: string }[],
      teams: (input.teams || []) as unknown as { id: string; name: string; program: string; teacher?: string }[],
      enrollments: input.enrollments || [],
      students: input.students || [],
    });
    return active.filter(c => scope.courseIds.has(c.id) || scope.teamIds.has(String(c.team || '')));
  }
  if (!isOpsLike(me.role)) return [];
  const scope = opsOwnScope({ name: me.name, email: me.email }, input.opsCourses, active);
  return active.filter(c => scope.courseIds.has(c.id));
}

export type CalendarEvent = {
  uid: string;
  date: string;
  start: string;
  end: string;
  summary: string;
  description: string;
  location: string;
};

/** One VEVENT per occurrence (prefer session rows; fall back to course date/time). */
export function calendarEventsFor<
  C extends CourseLike & { code?: string | null; team?: string },
>(
  courses: readonly C[],
  sessions: readonly CourseSession[],
  meta: { teams?: readonly TeamLike[]; programs?: readonly ProgramLike[] } = {},
): CalendarEvent[] {
  const teamName = (id: string) => meta.teams?.find(t => t.id === id)?.name || '';
  const programName = (id: string) => {
    const p = meta.programs?.find(x => x.id === id);
    return p ? (p.short || p.name) : '';
  };
  const occ = occurrences(courses, sessions);
  return occ.map(o => {
    const c = o.course;
    const team = teamName(String(c.team || ''));
    const prog = programName(c.program);
    const bits = [c.name];
    if (team) bits.push(team);
    else if (prog) bits.push(prog);
    const summary = bits.join(' · ');
    const lines = [
      c.code ? `课程编号：${c.code}` : '',
      team ? `队伍：${team}` : '',
      prog ? `项目：${prog}` : '',
      c.teacher ? `授课老师：${c.teacher}` : '',
      o.session?.title ? `课次：${o.session.title}` : '',
      o.session?.content ? `内容：${o.session.content}` : '',
    ].filter(Boolean);
    const uid = o.session ? `session-${o.session.id}@${CALENDAR_HOST}` : `course-${c.id}@${CALENDAR_HOST}`;
    return {
      uid,
      date: o.date,
      start: o.start,
      end: o.end || o.start,
      summary,
      description: lines.join('\n'),
      location: o.location || '',
    };
  });
}

/** RFC 5545 text escape. */
export function icsEscape(value: string): string {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

/** Fold content lines at 75 octets (RFC 5545). */
export function icsFold(line: string): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  let first = true;
  while (i < bytes.length) {
    const budget = first ? 75 : 74;
    let end = Math.min(i + budget, bytes.length);
    while (end > i && (bytes[end]! & 0xc0) === 0x80) end--; // don't split UTF-8
    if (end === i) end = Math.min(i + budget, bytes.length);
    const chunk = decoder.decode(bytes.subarray(i, end));
    parts.push(first ? chunk : ' ' + chunk);
    first = false;
    i = end;
  }
  return parts.join('\r\n');
}

/** YYYY-MM-DD + HH:MM → YYYYMMDDTHHMMSS (local, for TZID). */
export function formatLocalStamp(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim());
  if (!m) return null;
  const hh = String(Math.min(23, Number(m[1]))).padStart(2, '0');
  const mm = String(Math.min(59, Number(m[2]))).padStart(2, '0');
  return `${date.replace(/-/g, '')}T${hh}${mm}00`;
}

/** UTC DTSTAMP (YYYYMMDDTHHMMSSZ). */
export function formatUtcStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

const SHANGHAI_VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Asia/Shanghai',
  'X-LIC-LOCATION:Asia/Shanghai',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0800',
  'TZOFFSETTO:+0800',
  'TZNAME:CST',
  'DTSTART:19700101T000000',
  'END:STANDARD',
  'END:VTIMEZONE',
].join('\r\n');

export type BuildIcsOptions = {
  calName: string;
  events: readonly CalendarEvent[];
  now?: Date;
  /** Include VALARM 15 minutes before (default true). */
  alarm?: boolean;
};

export function buildCalendarIcs(opts: BuildIcsOptions): string {
  const now = opts.now || new Date();
  const stamp = formatUtcStamp(now);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${CALENDAR_PROD_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(opts.calName)}`,
    `X-WR-TIMEZONE:${CALENDAR_TZ}`,
    SHANGHAI_VTIMEZONE,
  ];
  for (const ev of opts.events) {
    const start = formatLocalStamp(ev.date, ev.start);
    const end = formatLocalStamp(ev.date, ev.end) || start;
    if (!start) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;TZID=${CALENDAR_TZ}:${start}`);
    lines.push(`DTEND;TZID=${CALENDAR_TZ}:${end}`);
    lines.push(`SUMMARY:${icsEscape(ev.summary)}`);
    if (ev.description) lines.push(`DESCRIPTION:${icsEscape(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    if (opts.alarm !== false) {
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT15M');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${icsEscape('课程提醒：' + ev.summary)}`);
      lines.push('END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/** HTTPS + webcal URLs for a token (path: /api/calendar/{token}.ics). */
export function calendarSubscribeUrls(origin: string, token: string) {
  const base = String(origin || '').replace(/\/$/, '') || `https://${CALENDAR_HOST}`;
  const path = `/api/calendar/${token}.ics`;
  const httpsUrl = `${base}${path}`;
  const webcalUrl = httpsUrl.replace(/^https:/i, 'webcal:').replace(/^http:/i, 'webcal:');
  return { httpsUrl, webcalUrl, path };
}

/** Re-export for callers that only need the name helper. */
export { canonicalTeacherName };
