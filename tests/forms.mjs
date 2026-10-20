// 收集表单: docx seed, validation, honeypot / throttle, superadmin-only admin API, and the 队伍绑定分发 flow.
// Runs the real Hono app (server/app.ts) with an in-memory FormRepo; no PostgreSQL.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { sign } from 'hono/jwt';

const outdir = 'node_modules/.cache/nexus-tests';
mkdirSync(outdir, { recursive: true });
await build({ entryPoints: { salesLib: 'lib/nexus/sales.ts', formsLib: 'lib/nexus/forms.ts', formsApp: 'server/app.ts', formsApi: 'server/forms.ts', postsApi2: 'server/posts.ts', xlsx: 'lib/nexus/xlsx.ts' }, outdir, bundle: true, platform: 'node', format: 'esm', packages: 'external', outExtension: { '.js': '.mjs' }, logLevel: 'error' });
const load = n => import(pathToFileURL(`${outdir}/${n}.mjs`).href + '?t=' + Date.now());
const F = await load('formsLib'), { createApp } = await load('formsApp'), A = await load('formsApi'), S = await load('postsApi2'), X = await load('xlsx');

// ---- seed matches the docx: 23 questions (01–22 with 18 split into type/total/speaking + confirmation) ---------
const qs = F.DEFAULT_FORM.questions.filter(q => q.type !== 'section');
assert.equal(F.DEFAULT_FORM.title, '报名学员竞赛信息收集表'); assert.equal(F.DEFAULT_FORM.titleEn, 'STUDENT COMPETITION INFORMATION FORM');
const q05 = F.DEFAULT_FORM.questions.find(q => q.id === 'q05');
assert.deepEqual(q05.options[2], { value: '港澳居民来往内地通行证', zh: '港澳居民来往内地通行证', en: 'MAINLAND TRAVEL PERMIT FOR HONG KONG AND MACAO RESIDENTS' });
assert(!q05.options.some(o => o.value === '港澳通行证'));
const mig25 = readFileSync('drizzle/0025_remove_form_checklist.sql', 'utf8');
assert(mig25.includes(':q23') && mig25.includes(':s7') && /version/.test(mig25));
const mig = readFileSync('drizzle/0024_form_title_hk_permit.sql', 'utf8');
assert(mig.includes("'报名学员竞赛信息收集表'") && mig.includes("'港澳通行证'") && mig.includes('MAINLAND TRAVEL PERMIT FOR HONG KONG AND MACAO RESIDENTS'));
assert.equal(qs.length, 24);
assert(!F.DEFAULT_FORM.questions.some(q => q.id === 'q23' || q.id === 's7' || /核对|CHECK BEFORE/.test(q.labelZh + q.labelEn)), 'checklist section removed');
assert.deepEqual(qs.find(q => q.id === 'q01').options.map(o => o.value), ['康莱德挑战赛', 'CBPA', 'CTB', 'iHOSA', '钻石挑战赛', '蓝海', 'MVP定制', '其他']);
assert(qs.every(q => q.labelZh && q.labelEn && q.labelEn === q.labelEn.toUpperCase()), 'every question is bilingual with an ALL-CAPS English line');
const req = qs.filter(q => q.required).map(q => q.id);
assert.deepEqual(req, ['q01', 'q02', 'q03', 'q04', 'q05', 'q06', 'q07', 'q08', 'q09', 'q10', 'q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17']);
assert.equal(qs.find(q => q.id === 'q19').options.length, 17, '16 MBTI types + 不确定');
const docx = readFileSync('lib/nexus/forms.ts', 'utf8');
for (const t of ['中文姓名及证件上英文拼音', '身份证明文件类型', '学校英文全称', '监护人邮箱', '过往竞赛经历', '其他报名补充说明']) assert(docx.includes(t), t);

// ---- validation -------------------------------------------------------------------------------------------
const good = { q01: ['CTB', '其他：WSC'], q02: '程雪晴 CHENG XUEQING', q03: '女', q04: '2009-05-12', q05: '护照', q06: 'E12345678', q07: '138 0013 8000', q08: 'xq@example.com', q09: '1 Road, Hangzhou, Zhejiang, China, 310000',
  q10: '杭州二中', q11: 'Hangzhou No.2 High School', q12: '1 Road, Binjiang, Hangzhou, China, 310052', q13: '公立', q14: 'G10', q15: '程父 CHENG FU', q16: '+86 13900139000', q17: 'p@example.com',
  q18: 'TOEFL', q18b: '105', q18c: '24', q19: 'INTJ', q21: '2025 AMC 10 Distinction', extra: 'dropped' };
let v = F.validateAnswers(F.DEFAULT_FORM.questions, good);
assert.deepEqual(v.errors, {}); assert(!('extra' in v.values));
v = F.validateAnswers(F.DEFAULT_FORM.questions, { ...good, q01: ['其他：'], q07: '12345', q08: 'nope', q04: '2009-13-40', q03: '未知' });
assert.deepEqual(Object.keys(v.errors).sort(), ['q01', 'q03', 'q04', 'q07', 'q08']);
assert.equal(F.validateAnswers(F.DEFAULT_FORM.questions, {}).errors.q02, '此项为必填');
assert.equal(F.phoneIssue('+852 9123 4567'), null); assert.equal(F.phoneIssue('13800138000'), null); assert(F.phoneIssue('0571-1234'));
assert.deepEqual(F.splitName('程雪晴 CHENG XUEQING'), { zh: '程雪晴', en: 'CHENG XUEQING' });

// ---- profile mapping + dedupe + plan ---------------------------------------------------------------------
const snap = F.snapshotAnswers(F.DEFAULT_FORM.questions, F.validateAnswers(F.DEFAULT_FORM.questions, good).values);
const mapped = F.profileFromAnswers(snap);
assert.equal(mapped.name, '程雪晴'); assert.equal(mapped.grade, 'G10');
assert.equal(mapped.profile.nameEn, 'CHENG XUEQING'); assert.equal(mapped.profile.phone, '138 0013 8000'); assert.equal(mapped.profile.school, '杭州二中');
assert.equal(mapped.profile.toeflIelts, 'TOEFL · 总分 105 · 口语 24'); assert.equal(mapped.profile.signupPrograms, 'CTB、其他：WSC'); assert.equal(mapped.profile.awardsA, '2025 AMC 10 Distinction');
assert(!('formExtras' in mapped.profile), 'confirmation checklist is not stored as profile data');
const unmappedSnap = [...snap, { id: 'qx', type: 'text', labelZh: '微信号', labelEn: 'WECHAT', mapTo: '', value: 'xq_wx' }];
assert.equal(F.profileFromAnswers(unmappedSnap).profile.formExtras, '微信号：xq_wx', 'unmapped answers stay attached as extra info');
const existing = { id: 'S-OLD', name: '程雪晴', program: 'ctb', team: '', status: '待开课', sales: '顾问 A', updated: '', grade: '', health: '状态良好', healthNote: '', healthUpdated: '', healthBy: '', profile: { phone: '13800138000', school: '旧学校' } };
assert.deepEqual(F.findDuplicates({ name: '程雪晴', phone: '+86 138-0013-8000' }, [existing]).map(d => d.strength), ['name+phone']);
assert.deepEqual(F.findDuplicates({ name: '别人', phone: '13800138000' }, [existing]).map(d => d.strength), ['phone']);
assert.deepEqual(F.findDuplicates({ name: '程雪晴', phone: '13900000000' }, [existing]).map(d => d.strength), ['name']);
const plan = F.planAssignment({ id: 'FS-1', answers: snap, createdAt: '2026-10-20T02:00:00.000Z' }, { program: 'ctb', team: 'T-CTB' }, { students: [existing], enrollments: [], linkTo: 'S-OLD', by: '张捷嘉', stamp: '10-20 10:00', newId: 'S-NEW' });
assert.equal(plan.created, false); assert.equal(plan.student.id, 'S-OLD');
assert.equal(plan.student.profile.school, '旧学校', 'linking never overwrites values on file'); assert.equal(plan.student.profile.schoolEn, 'Hangzhou No.2 High School', 'blank fields are filled');
assert.equal(plan.student.team, 'T-CTB'); assert.equal(plan.student.sales, '顾问 A'); assert.equal(plan.enrollment.team, 'T-CTB'); assert(plan.enrollmentCreated);

// ---- export --------------------------------------------------------------------------------------------
const sub0 = { id: 'FS-1', formId: 'F', formVersion: 1, answers: snap, name: '程雪晴', phone: 'x', status: '待分配', program: null, team: null, studentId: null, assignedBy: null, assignedAt: null, note: '', createdAt: '2026-10-20T02:00:00.000Z' };
const table = F.submissionTable([sub0]);
assert.equal(table[0][4], '报名项目'); assert(F.toCsv(table).startsWith('\uFEFF提交时间,'));
const xl = X.buildXlsx(table); assert.equal(xl[0], 0x50); assert.equal(xl[1], 0x4b, 'xlsx is a zip');

// ---- API: public + permissions + assign ------------------------------------------------------------------
const form = { id: 'F-1', slug: 'signup-test1', ...structuredClone(F.DEFAULT_FORM), open: true, version: 1 };
const repo = A.memoryFormRepo({ forms: [form], students: [existing], teams: [{ id: 'T-CTB', program: 'ctb', name: 'CTB 一队' }, { id: 'T-CTB2', program: 'ctb', name: 'CTB 二队' }], sales: [{ id: 2, name: 'Alex', salesName: '顾问 Alex', region: '华东' }, { id: 7, name: '王销售', salesName: '顾问 王销售', region: '华南' }] });
const users = { 1: { id: 1, email: 'xujin@nexus.local', username: '许瑾', name: '许瑾', role: 'ops', salesName: null, active: true, mustChangePassword: false },
  2: { id: 2, email: 'sales@nexus.demo', username: 'Alex', name: 'Alex', role: 'sales', salesName: '顾问 Alex', active: true, mustChangePassword: false },
  3: { id: 3, email: 'zhangjiejia@nexus.local', username: '张捷嘉', name: '张捷嘉', role: 'superadmin', salesName: null, active: true, mustChangePassword: false },
  4: { id: 4, email: 't@nexus.local', username: '老师', name: '老师', role: 'teacher', salesName: null, active: true, mustChangePassword: false } };
let who = null;
const fakeDb = { select: () => ({ from: () => ({ where: () => ({ limit: async () => (who ? [who] : []) }) }) }), execute: async () => ({ rows: [] }) };
const config = { databaseUrl: 'x', jwtSecret: 'test-secret-0123456789-0123456789-abcdef', port: 0, host: '127.0.0.1', env: 'test', corsOrigins: [], publicOrigin: '' };
const app = createApp(fakeDb, config, new Date(), S.memoryRepo([], []), repo);
const call = async (method, path, { body, as, portal, ip = '1.1.1.1' } = {}) => {
  who = as ? users[as] : null;
  const tok = as ? await sign({ sub: String(as), role: users[as].role, ...(portal ? { portal, portals: ['ops', 'teacher'] } : {}), exp: Math.floor(Date.now() / 1000) + 600 }, config.jwtSecret, 'HS256') : null;
  const res = await app.request(path, { method, headers: { 'x-real-ip': ip, ...(body ? { 'content-type': 'application/json' } : {}), ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};
let r = await call('GET', '/api/public/forms/signup-test1');
assert.equal(r.status, 200); assert.equal(r.json.form.questions.length, F.DEFAULT_FORM.questions.length);
assert(r.json.form.questions.every(q => !('mapTo' in q)) && !('id' in r.json.form), 'public form hides mapping + internal id');
assert.equal((await call('GET', '/api/public/forms/nope-nope')).status, 404);
assert.equal((await call('POST', '/api/public/forms/signup-test1', { body: { answers: good, elapsed: 500 } })).status, 400, 'too fast');
r = await call('POST', '/api/public/forms/signup-test1', { body: { answers: good, elapsed: 60000, website: 'http://spam' } });
assert.equal(r.status, 200); assert.equal(repo.subs.size, 0, 'honeypot submissions are dropped silently');
r = await call('POST', '/api/public/forms/signup-test1', { body: { answers: { ...good, q08: 'bad' }, elapsed: 60000 } });
assert.equal(r.status, 400); assert(r.json.errors.q08);
r = await call('POST', '/api/public/forms/signup-test1', { body: { answers: good, elapsed: 60000 } });
assert.equal(r.status, 201); assert.equal(repo.subs.size, 1);
const subId = r.json.id; const stored = repo.subs.get(subId);
assert.equal(stored.name, '程雪晴'); assert.equal(stored.status, '待分配'); assert.equal(stored.answers.find(a => a.id === 'q02').labelZh, '中文姓名及证件上英文拼音', 'label snapshot');
// Throttle: 8 per IP per 10 minutes.
let last; for (let i = 0; i < 9; i++) last = await call('POST', '/api/public/forms/signup-test1', { body: { answers: good, elapsed: 60000 }, ip: '9.9.9.9' });
assert.equal(last.status, 429);
for (const id of [...repo.subs.keys()]) if (id !== subId) repo.subs.delete(id);

// Admin endpoints: superadmin only (ops, sales, teacher, superadmin-in-teacher-portal, anonymous are refused).
const adminCalls = [['GET', '/api/admin/forms'], ['POST', '/api/admin/forms', {}], ['PUT', '/api/admin/forms/F-1', { title: 'x' }], ['DELETE', '/api/admin/forms/F-1'], ['GET', '/api/admin/forms/F-1/submissions'],
  ['GET', `/api/admin/form-submissions/${subId}/duplicates`], ['PATCH', `/api/admin/form-submissions/${subId}`, { status: '已忽略' }], ['DELETE', `/api/admin/form-submissions/${subId}`], ['POST', '/api/admin/form-submissions/assign', { ids: [subId], team: 'T-CTB' }]];
for (const [m, p, body] of adminCalls) {
  for (const as of [1, 2, 4]) assert.equal((await call(m, p, { as, body })).status, 403, `${m} ${p} as ${users[as].role}`);
  assert.equal((await call(m, p, { as: 3, portal: 'teacher', body })).status, 403, `${m} ${p} superadmin in teacher portal`);
  assert.equal((await call(m, p, { body })).status, 401);
}
assert.equal(repo.subs.get(subId).status, '待分配', 'refused calls changed nothing');
r = await call('GET', '/api/admin/forms', { as: 3 });
assert.equal(r.status, 200); assert.equal(r.json.forms[0].counts.pending, 1);
assert.equal((await call('GET', '/api/admin/forms/F-1/submissions', { as: 3 })).json.submissions.length, 1);

// Editing questions bumps the version but never touches stored answers.
const edited = { ...form, questions: form.questions.map(q => q.id === 'q02' ? { ...q, labelZh: '学生姓名' } : q) };
r = await call('PUT', '/api/admin/forms/F-1', { as: 3, body: edited });
assert.equal(r.status, 200); assert.equal(r.json.form.version, 2);
assert.equal(repo.subs.get(subId).answers.find(a => a.id === 'q02').labelZh, '中文姓名及证件上英文拼音');
assert.equal((await call('PUT', '/api/admin/forms/F-1', { as: 3, body: { ...edited, questions: [{ type: 'single', labelZh: '无选项', options: [] }] } })).status, 400);
assert.equal((await call('DELETE', '/api/admin/forms/F-1', { as: 3 })).status, 409, 'forms with submissions cannot be deleted');

// Assign: duplicate warning first (name + phone matches S-OLD), then explicit link / new.
r = await call('POST', '/api/admin/form-submissions/assign', { as: 3, body: { ids: [subId], team: 'T-CTB' } });
assert.equal(r.status, 409); assert.equal(r.json.error, 'duplicates'); assert.equal(r.json.duplicates[subId][0].studentId, 'S-OLD');
assert.equal((await call('POST', '/api/admin/form-submissions/assign', { as: 3, body: { ids: [subId], team: 'T-NONE' } })).status, 400);
r = await call('POST', '/api/admin/form-submissions/assign', { as: 3, body: { ids: [subId], team: 'T-CTB', links: { [subId]: 'new' }, salesUserId: 2 } });
assert.equal(r.status, 200); assert.equal(r.json.results[0].created, true);
const newId = r.json.results[0].student, st = repo.studentMap.get(newId);
assert.equal(st.name, '程雪晴'); assert.equal(st.team, 'T-CTB'); assert.equal(st.program, 'ctb'); assert.equal(st.sales, 'Alex', '负责销售 = sales account name');
const Sales = await import(pathToFileURL(`${outdir}/salesLib.mjs`).href);
assert(Sales.salesOwns(st.sales, users[2]), 'the bound salesperson sees the student'); assert(!Sales.salesOwns(st.sales, { name: '王销售', salesName: '顾问 王销售' }));
assert.equal(st.profile.idType, '护照'); assert.equal(st.grade, 'G10');
assert.equal(st.profile.idNumber, 'E12345678'); assert.equal(st.profile.source, '报名收集表'); assert.equal(st.profile.formSubmission, subId);
assert([...repo.enrollmentMap.values()].some(e => e.student === newId && e.team === 'T-CTB' && e.program === 'ctb'), 'added as a team member');
const after = repo.subs.get(subId);
assert.equal(after.status, '已分配'); assert.equal(after.studentId, newId); assert.equal(after.assignedBy, '张捷嘉');
assert.equal((await call('PATCH', `/api/admin/form-submissions/${subId}`, { as: 3, body: { status: '已忽略' } })).status, 400, 'assigned rows keep their status');
assert.equal((await call('PATCH', `/api/admin/form-submissions/${subId}`, { as: 3, body: { status: '已分配' } })).status, 400, '已分配 only via assign');
// Second submission links to the existing student instead.
r = await call('POST', '/api/public/forms/signup-test1', { body: { answers: good, elapsed: 60000, website: '' }, ip: '2.2.2.2' });
const sub2 = r.json.id;
r = await call('POST', '/api/admin/form-submissions/assign', { as: 3, body: { ids: [sub2], team: 'T-CTB', links: { [sub2]: 'S-OLD' } } });
assert.equal(r.status, 200); assert.equal(r.json.results[0].created, false); assert.equal(repo.studentMap.get('S-OLD').profile.school, '旧学校');
// Closing the form stops public submissions.
assert.equal((await call('PUT', '/api/admin/forms/F-1', { as: 3, body: { open: false } })).status, 200);
assert.equal((await call('POST', '/api/public/forms/signup-test1', { body: { answers: good, elapsed: 60000 }, ip: '3.3.3.3' })).status, 403);
assert.equal((await call('GET', '/api/public/forms/signup-test1')).json.form.open, false);
// Sales accounts list + bad id; re-bind an assigned row (team + sales) later; bulk assign with one salesperson.
r = await call('GET', '/api/admin/forms/sales-accounts', { as: 3 }); assert.deepEqual(r.json.accounts.map(a => [a.name, a.region]), [['Alex', '华东'], ['王销售', '华南']]);
assert.equal((await call('GET', '/api/admin/forms/sales-accounts', { as: 2 })).status, 403);
assert.equal((await call('POST', '/api/admin/form-submissions/assign', { as: 3, body: { ids: [subId], team: 'T-CTB', salesUserId: 999 } })).status, 400);
r = await call('POST', '/api/admin/form-submissions/assign', { as: 3, body: { ids: [subId], team: 'T-CTB2', salesUserId: 7 } });
assert.equal(r.status, 200); assert.equal(r.json.results[0].student, newId, 're-bind keeps the same student');
assert.equal(repo.studentMap.get(newId).sales, '王销售'); assert.equal(repo.studentMap.get(newId).team, 'T-CTB2'); assert.equal(repo.subs.get(subId).team, 'T-CTB2');
assert([...repo.enrollmentMap.values()].some(e => e.student === newId && e.team === 'T-CTB2'));
// Bulk: two fresh submissions (different people) to one team + one salesperson.
await call('PUT', '/api/admin/forms/F-1', { as: 3, body: { open: true } });
const mk = async (name, phone, ip) => (await call('POST', '/api/public/forms/signup-test1', { body: { answers: { ...good, q02: name, q07: phone, q05: '港澳居民来往内地通行证' }, elapsed: 60000 }, ip })).json.id;
const b1 = await mk('甲同学 JIA', '13700000001', '5.5.5.1'), b2 = await mk('乙同学 YI', '13700000002', '5.5.5.2');
r = await call('POST', '/api/admin/form-submissions/assign', { as: 3, body: { ids: [b1, b2], team: 'T-CTB', salesUserId: 2 } });
assert.equal(r.status, 200); assert.equal(r.json.results.length, 2);
for (const x of r.json.results) { const stx = repo.studentMap.get(x.student); assert.equal(stx.sales, 'Alex'); assert.equal(stx.team, 'T-CTB'); assert.equal(stx.profile.idType, '港澳居民来往内地通行证'); }
// Public page: submit opens a preview; only 确认提交 calls the API, after a 3 s countdown restarted on each open.
const pf = readFileSync('components/nexus/public-form.tsx', 'utf8');
assert(/setWait\(3\); setPreview\(true\)/.test(pf), 'submit opens the preview with a 3 s countdown');
assert.equal((pf.match(/publicFormApi\.submit\(/g) || []).length, 1); assert(/async function confirmSubmit\(\) \{\s*if \(wait > 0 \|\| busy\) return;/.test(pf));
for (const s of ['确认提交', 'CONFIRM & SUBMIT', '返回修改', 'BACK TO EDIT', '请核对信息', 'website: hp.current', 'elapsed: nowMs()']) assert(pf.includes(s), s);
// Share tab: plain QR + poster downloads embed the LIVE url; poster prefers /form-poster/* when present.
const poster = readFileSync('lib/nexus/form-poster.ts', 'utf8');
assert(poster.includes("assetUrl('form-poster/bg.png')") && poster.includes('1080') && poster.includes('1920'));
assert(poster.includes('微信扫码填写') && poster.includes('SCAN TO REGISTER') && poster.includes('填写后由老师统一分配队伍') && poster.includes('bestcrm.cc'));
const share = readFileSync('components/nexus/forms-admin.tsx', 'utf8');
assert(share.includes('下载海报 PNG') && share.includes('下载二维码 PNG') && share.includes('buildFormPoster') && share.includes('buildPlainQrPng'));
assert(!share.includes("from 'qrcode'"), 'QR generation lives in form-poster.ts');
console.log('forms: ok');
