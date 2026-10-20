// 课表日历 ICS: content, owner filtering, token 404, subscribe URL shape.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { Hono } from 'hono';

const outdir = 'node_modules/.cache/nexus-tests';
mkdirSync(outdir, { recursive: true });
await build({
  entryPoints: { calendarLib: 'lib/nexus/calendar.ts' },
  outdir, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  outExtension: { '.js': '.mjs' }, logLevel: 'error',
});
const C = await import(pathToFileURL(`${outdir}/calendarLib.mjs`).href + '?t=' + Date.now());

// ---- token shape ------------------------------------------------------------------------------------------
const t1 = C.newCalendarToken();
assert.match(t1, /^[A-Za-z0-9_-]{20,64}$/);
assert.notEqual(C.newCalendarToken(), t1);
assert.equal(C.normalizeCalendarToken(t1 + '.ics'), t1);
assert.equal(C.normalizeCalendarToken(t1), t1);
assert.equal(C.normalizeCalendarToken('short'), null);
assert.equal(C.normalizeCalendarToken('../../../etc/passwd.ics'), null);
assert.equal(C.normalizeCalendarToken(''), null);
assert.equal(C.isCancelledCourseStatus('已取消'), true);
assert.equal(C.isCancelledCourseStatus('已安排'), false);
assert.equal(C.isCancelledCourseStatus('已完成'), false);

// ---- owner filtering (same visibility idea as useVisible / opsOwnScope) ------------------------------------
const opsCourses = [
  { id: 'OC1', code: 'WS2026017-1-1', teacher: '王钰', opsTeacher: 'xujin@nexus.local', name: '商业计划' },
  { id: 'OC2', code: 'COND02501-11A', teacher: '李老师', opsTeacher: 'other@nexus.local', name: '写作' },
];
const courses = [
  { id: 'A', name: '商业计划', program: 'bpa', team: 'T1', teacher: '王钰', date: '2026-10-13', time: '14:00–15:30', status: '已安排', code: 'WS2026017-1-1', location: 'A302' },
  { id: 'B', name: '路演', program: 'bpa', team: 'T2', teacher: '李老师', date: '2026-10-14', time: '09:00–10:00', status: '已安排', code: 'COND02501-11A' },
  { id: 'C', name: '已取消课', program: 'bpa', team: 'T1', teacher: '王钰', date: '2026-10-15', time: '10:00–11:00', status: '已取消', code: 'WS2026017-1-9' },
];
const teams = [{ id: 'T1', name: '康莱德一队', teacher: '王钰' }, { id: 'T2', name: '二队', teacher: '李老师' }];

const xu = C.coursesForCalendarOwner({ name: '许瑾', email: 'xujin@nexus.local', role: 'ops' }, { opsCourses, courses, teams });
assert.deepEqual(xu.map(c => c.id), ['A'], 'ops sees courses where they are 运营老师 (via ops_courses code)');

const wang = C.coursesForCalendarOwner({ name: '王钰', email: 'wang@nexus.local', role: 'teacher' }, { opsCourses, courses, teams });
assert.ok(wang.some(c => c.id === 'A'));
assert.ok(!wang.some(c => c.id === 'B'));
assert.ok(!wang.some(c => c.id === 'C'), 'cancelled courses omitted');

assert.equal(C.coursesForCalendarOwner({ name: 'Alex', email: 'sales@nexus.demo', role: 'sales' }, { opsCourses, courses, teams }).length, 0);

// Teacher who is only 授课老师 on course A by name (no ops_courses row for them as ops):
const coachOnly = C.coursesForCalendarOwner({ name: '王钰', email: 'wy@nexus.local', role: 'ops' }, {
  opsCourses: [{ id: 'OC9', code: 'X', teacher: '别人', opsTeacher: 'wy@nexus.local', name: 'x' }],
  courses: [
    { id: 'A', name: '商业计划', program: 'bpa', team: 'T1', teacher: '王钰', date: '2026-10-13', time: '14:00–15:30', status: '已安排', code: 'WS2026017-1-1' },
    { id: 'Z', name: '其他', program: 'bpa', team: 'T2', teacher: '别人', date: '2026-10-14', time: '09:00–10:00', status: '已安排', code: 'X' },
  ],
  teams,
});
assert.ok(coachOnly.some(c => c.id === 'A'), 'ops who teaches by name sees own 授课课程');
assert.ok(coachOnly.some(c => c.id === 'Z'), 'ops also sees 运营老师 courses by email');

// ---- ICS content ------------------------------------------------------------------------------------------
const sessions = [
  { id: 's1', course: 'A', date: '2026-10-13', start: '14:00', end: '15:30', location: 'A302', title: '开题', content: '介绍赛制' },
  { id: 's2', course: 'A', date: '2026-10-20', start: '14:00', end: '15:30' },
];
const events = C.calendarEventsFor(xu, sessions, { teams, programs: [{ id: 'bpa', name: '商业计划大赛', short: 'BPA' }] });
assert.equal(events.length, 2);
assert.equal(events[0].uid, 'session-s1@bestcrm.cc');
assert.match(events[0].summary, /商业计划/);
assert.match(events[0].summary, /康莱德一队/);
assert.match(events[0].description, /课程编号：WS2026017-1-1/);
assert.match(events[0].description, /授课老师：王钰/);
assert.match(events[0].description, /课次：开题/);

const ics = C.buildCalendarIcs({
  calName: 'BEST课表 · 许瑾',
  events,
  now: new Date('2026-10-20T02:00:00Z'),
});
assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
assert.match(ics, /PRODID:-\/\/BEST项目资料库\/\/Course Calendar\/\/CN/);
assert.match(ics, /X-WR-CALNAME:BEST课表 · 许瑾/);
assert.match(ics, /X-WR-TIMEZONE:Asia\/Shanghai/);
assert.match(ics, /UID:session-s1@bestcrm\.cc/);
assert.match(ics, /DTSTART;TZID=Asia\/Shanghai:20261013T140000/);
assert.match(ics, /DTEND;TZID=Asia\/Shanghai:20261013T153000/);
assert.match(ics, /SUMMARY:/);
assert.match(ics, /BEGIN:VALARM/);
assert.match(ics, /TRIGGER:-PT15M/);
assert.match(ics, /END:VCALENDAR\r\n$/);
assert.doesNotMatch(ics, /路演/);

assert.equal(C.icsEscape('a;b,c\\d\ne'), 'a\\;b\\,c\\\\d\\ne');
assert.equal(C.formatLocalStamp('2026-10-13', '9:05'), '20261013T090500');
assert.equal(C.formatLocalStamp('bad', '9:05'), null);

const urls = C.calendarSubscribeUrls('https://bestcrm.cc', t1);
assert.equal(urls.httpsUrl, `https://bestcrm.cc/api/calendar/${t1}.ics`);
assert.equal(urls.webcalUrl, `webcal://bestcrm.cc/api/calendar/${t1}.ics`);
assert.equal(C.calendarSubscribeUrls('http://1.13.182.30:8080', t1).webcalUrl, `webcal://1.13.182.30:8080/api/calendar/${t1}.ics`);

// ---- HTTP feed path: valid token → ICS, unknown → 404 (mirrors server/calendar.ts) ------------------------
const TOKEN = 'CalFeedTokenTestValue_0123456789ab';
const tokenUsers = new Map([[TOKEN, { name: '许瑾', email: 'xujin@nexus.local', role: 'ops', active: true }]]);

const feed = new Hono().basePath('/api');
feed.get('/calendar/:token{[A-Za-z0-9_-]+\\.ics}', async c => {
  const token = C.normalizeCalendarToken(c.req.param('token'));
  if (!token) return c.json({ error: 'not_found' }, 404);
  const user = tokenUsers.get(token);
  if (!user || !user.active || user.role === 'sales') return c.json({ error: 'not_found' }, 404);
  const mine = C.coursesForCalendarOwner(user, { opsCourses, courses, teams });
  const ev = C.calendarEventsFor(mine, sessions, { teams, programs: [{ id: 'bpa', name: '商业计划大赛', short: 'BPA' }] });
  const body = C.buildCalendarIcs({ calName: `BEST课表 · ${user.name}`, events: ev });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="best-courses.ics"',
    },
  });
});

let res = await feed.request(`/api/calendar/${TOKEN}.ics`);
assert.equal(res.status, 200);
assert.match(res.headers.get('content-type') || '', /text\/calendar/);
assert.match(res.headers.get('content-disposition') || '', /best-courses\.ics/);
let body = await res.text();
assert.match(body, /UID:session-s1@bestcrm\.cc/);
assert.match(body, /商业计划/);
assert.doesNotMatch(body, /路演/);

res = await feed.request('/api/calendar/not-a-real-token-zzzzzzzzzzzz.ics');
assert.equal(res.status, 404, 'unknown token → 404');
assert.match((await res.json()).error, /not_found/);

res = await feed.request('/api/calendar/nope.ics');
assert.equal(res.status, 404);

// Rotating token invalidates old URL
tokenUsers.delete(TOKEN);
tokenUsers.set('NewTokenAfterRotate_0123456789abcd', { name: '许瑾', email: 'xujin@nexus.local', role: 'ops', active: true });
res = await feed.request(`/api/calendar/${TOKEN}.ics`);
assert.equal(res.status, 404, 'old token stops working after rotate');
res = await feed.request('/api/calendar/NewTokenAfterRotate_0123456789abcd.ics');
assert.equal(res.status, 200);

// ---- wiring / migration -----------------------------------------------------------------------------------
assert.match(readFileSync('drizzle/0027_user_calendar_feed_token.sql', 'utf8'), /calendar_feed_token/);
const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
assert.ok(journal.entries.some(e => e.tag === '0027_user_calendar_feed_token'));
assert.match(readFileSync('db/schema.ts', 'utf8'), /calendarFeedToken/);
const appSrc = readFileSync('server/app.ts', 'utf8');
assert.match(appSrc, /registerPublicCalendarRoutes/);
assert.match(appSrc, /registerCalendarRoutes/);
assert.ok(readFileSync('server/calendar.ts', 'utf8').includes("/calendar/:token{[A-Za-z0-9_-]+\\.ics}"));
assert.match(readFileSync('components/nexus/modules.tsx', 'utf8'), /CalendarSubscribeBlock/);
assert.match(readFileSync('lib/nexus/api.ts', 'utf8'), /calendarSubscription/);

console.log('calendar ok');
