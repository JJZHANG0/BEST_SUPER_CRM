#!/usr/bin/env node
/**
 * Rematch 教练/授课老师 → teams from existing ops_courses (TEAM … in course name)
 * + align 郝震焜 → 郝震昆. Prefer operational teams.teacher when it already names a coach account.
 *
 * Usage (on box or server with psql + DATABASE_URL):
 *   DATABASE_URL=… node scripts/rematch-coach-teams.mjs [--dry-run]
 * Prefers `psql` so it works without a local node_modules/pg.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const DRY = process.argv.includes('--dry-run');
const COACHES = new Set(['王皓萱','李进坚','董之恒','郑永雄','吴奎','刘仲','钱其萩','邓金平','王银申','罗超','王志衡','张捷嘉','杜步天','张金阳','王钰','花宇轩','郝震昆','徐新泽','马超','贺迪']);
// Blacklisted: never (re)assign as team teacher; their historical course rows stay intact.
const BLACKLIST = new Set(['夏宏伟']);
const ALIAS = { '郝震焜': '郝震昆' };
const teamCore = (name) => String(name || '').replace(/team/gi, '').replace(/[「」『』"“”\s]/g, '').trim();
const programOf = (name) => {
  const n = String(name || '').toLowerCase();
  if (/康莱德|conrad|cond/.test(n)) return 'conrad';
  if (/bpa/.test(n)) return 'bpa';
  if (/ctb/.test(n)) return 'ctb';
  if (/ihosa/.test(n)) return 'ihosa';
  if (/mvp/.test(n)) return 'mvp';
  return '';
};
function courseTeams(course, teams) {
  const m = /team(.*)$/i.exec(course.name || '');
  if (!m) return [];
  const tail = teamCore(m[1]);
  const program = programOf(course.name);
  let best = 0, ids = [];
  for (const t of teams) {
    if (program && t.program !== program) continue;
    const core = teamCore(t.name);
    if (core.length < 1 || !tail.startsWith(core)) continue;
    if (core.length > best) { best = core.length; ids = [t]; }
    else if (core.length === best) ids.push(t);
  }
  return ids;
}
const canon = (n) => ALIAS[String(n || '').trim()] || String(n || '').trim();

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL required'); process.exit(2); }

function psql(sql, format = 'csv') {
  const args = [url, '-v', 'ON_ERROR_STOP=1', '-c', sql];
  if (format === 'csv') args.splice(1, 0, '-A', '-F', ',', '--csv');
  else if (format === 'tuples') args.splice(1, 0, '-t', '-A');
  const r = spawnSync('psql', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status || 1);
  }
  return r.stdout;
}
function parseCsv(text) {
  const lines = text.replace(/\r/g, '').trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cols = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { q = !q; continue; }
      if (c === ',' && !q) { cols.push(cur); cur = ''; continue; }
      cur += c;
    }
    cols.push(cur);
    const o = {}; headers.forEach((h, i) => o[h] = cols[i] ?? ''); return o;
  });
}
function esc(s) { return String(s).replace(/'/g, "''"); }

const teams = parseCsv(psql(`COPY (SELECT id, name, program, teacher FROM teams) TO STDOUT WITH CSV HEADER`));
const courses = parseCsv(psql(`COPY (SELECT id, code, name, teacher, status FROM ops_courses) TO STDOUT WITH CSV HEADER`));
const enrollments = parseCsv(psql(`COPY (SELECT student, team FROM enrollments) TO STDOUT WITH CSV HEADER`));
const students = parseCsv(psql(`COPY (SELECT id, team FROM students) TO STDOUT WITH CSV HEADER`));

const report = { dryRun: DRY, aliasCourseRows: 0, teamUpdates: [], multiCoach: [], unmatchedCourses: [], teachers: {}, orphans: [] };
const aliasCount = Number(psql(`SELECT count(*) FROM ops_courses WHERE teacher = '郝震焜'`, 'tuples').trim() || 0);
report.aliasCourseRows = aliasCount;

const map = new Map();
const perTeacher = {};
for (const c of courses) {
  const teacher = canon(c.teacher);
  if (BLACKLIST.has(teacher)) { report.unmatchedCourses.push({ code: c.code, name: c.name, teacher, reason: 'blacklisted' }); continue; }
  if (!teacher) { report.unmatchedCourses.push({ code: c.code, name: c.name, reason: 'no_teacher' }); continue; }
  const linked = courseTeams(c, teams);
  if (!linked.length) {
    if (/team/i.test(c.name)) report.unmatchedCourses.push({ code: c.code, name: c.name, teacher, reason: 'no_team_match' });
    continue;
  }
  for (const t of linked) {
    if (!map.has(t.id)) map.set(t.id, new Map());
    const m = map.get(t.id);
    const cur = m.get(teacher) || { active: 0, total: 0 };
    cur.total++;
    if (c.status === '进行中') cur.active++;
    m.set(teacher, cur);
  }
  if (!perTeacher[teacher]) perTeacher[teacher] = { teams: new Set(), courses: [] };
  perTeacher[teacher].courses.push({ code: c.code, name: c.name, status: c.status });
  for (const t of linked) perTeacher[teacher].teams.add(t.name);
}

const sqlParts = [];
if (aliasCount) {
  sqlParts.push(`UPDATE ops_courses SET teacher = '郝震昆', updated_at = now() WHERE teacher = '郝震焜';`);
  sqlParts.push(`UPDATE teachers SET active = false, note = CASE WHEN coalesce(note,'') = '' THEN '已与郝震昆合并' ELSE note || ' · 已与郝震昆合并' END, updated_at = now() WHERE name = '郝震焜' AND EXISTS (SELECT 1 FROM teachers t2 WHERE t2.name = '郝震昆');`);
  sqlParts.push(`UPDATE teachers SET name = '郝震昆', updated_at = now() WHERE name = '郝震焜' AND NOT EXISTS (SELECT 1 FROM teachers t2 WHERE t2.name = '郝震昆');`);
}

for (const [teamId, coaches] of map) {
  const team = teams.find(t => t.id === teamId);
  const list = [...coaches.entries()].map(([name, s]) => ({ name, ...s }));
  if (list.length > 1) report.multiCoach.push({ team: team.name, coaches: list.map(x => x.name), current: team.teacher });
  const current = canon(team.teacher);
  if (COACHES.has(current) && coaches.has(current)) continue;
  list.sort((a, b) => b.active - a.active || b.total - a.total || a.name.localeCompare(b.name, 'zh'));
  const primary = list[0]?.name;
  if (!primary || primary === team.teacher) continue;
  if (COACHES.has(current) && current !== primary) {
    report.teamUpdates.push({ team: team.name, from: team.teacher, to: primary, skipped: 'prefer_operational_coach' });
    continue;
  }
  report.teamUpdates.push({ team: team.name, from: team.teacher, to: primary, skipped: false });
  sqlParts.push(`UPDATE teams SET teacher = '${esc(primary)}', updated_at = now() WHERE id = '${esc(teamId)}';`);
}

for (const [teacher, info] of Object.entries(perTeacher)) {
  const ids = new Set();
  for (const [tid, coaches] of map) if (coaches.has(teacher)) ids.add(tid);
  for (const t of teams) if (canon(t.teacher) === teacher) ids.add(t.id);
  // After planned updates, teams getting this primary also count
  for (const u of report.teamUpdates) if (!u.skipped && u.to === teacher) {
    const t = teams.find(x => x.name === u.team); if (t) ids.add(t.id);
  }
  const stu = new Set();
  for (const e of enrollments) if (ids.has(e.team)) stu.add(e.student);
  for (const s of students) if (ids.has(s.team)) stu.add(s.id);
  report.teachers[teacher] = {
    courses: info.courses,
    teams: teams.filter(t => ids.has(t.id)).map(t => ({ id: t.id, name: t.name })),
    studentsVisible: stu.size,
    isCoachAccount: COACHES.has(teacher),
  };
}
for (const c of COACHES) {
  if (!report.teachers[c]) report.teachers[c] = { courses: [], teams: [], studentsVisible: 0, isCoachAccount: true, unassigned: true };
}
report.orphans = report.unmatchedCourses.filter(x => x.reason === 'no_team_match' && COACHES.has(x.teacher || ''));

if (!DRY && sqlParts.length) {
  const sql = 'BEGIN;\n' + sqlParts.join('\n') + '\nCOMMIT;\n';
  writeFileSync('/tmp/rematch-coach-teams.sql', sql);
  const r = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/rematch-coach-teams.sql'], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(r.status || 1); }
  report.appliedSqlStatements = sqlParts.length;
}

console.log(JSON.stringify(report, null, 2));
