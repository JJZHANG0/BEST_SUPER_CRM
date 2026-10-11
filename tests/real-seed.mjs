import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const S=await load('lib/nexus/real-seed.ts');
const O=await load('lib/nexus/ops.ts');
const staff=['zhangjiejia@nexus.local','chengxueqing@nexus.local','zhangxuehang@nexus.local','xujin@nexus.local','fangyanqi@nexus.local'];
assert.equal(S.realProjects.length,12);assert.equal(S.realCourses.length,76);assert.equal(S.realTeachers.length,38);
assert.equal(S.realLessons.length,5);assert.equal(S.realLessonFeedbacks.length,4);
const uniq=(l,k)=>new Set(l.map(x=>x[k])).size===l.length;
for(const [l,k] of [[S.realProjects,'id'],[S.realProjects,'code'],[S.realCourses,'id'],[S.realCourses,'code'],[S.realTeachers,'name'],[S.realLessons,'id']])assert(uniq(l,k),'unique '+k);
const pids=new Set(S.realProjects.map(p=>p.id)),cids=new Set(S.realCourses.map(c=>c.id)),types=new Set(O.defaultClassTypes.map(t=>t.id));
for(const c of S.realCourses){assert(pids.has(c.project),c.code);assert(types.has(c.classType),c.code);assert(c.opsTeacher===''||staff.includes(c.opsTeacher),c.code);assert(O.courseStatuses.includes(c.status));}
for(const l of S.realLessons){assert(cids.has(l.course));assert(l.date>='2026-10-01','only records from 2026-10-01');assert(staff.includes(l.opsTeacher));assert.equal(l.amount,O.computeAllowance(l.rate,l.unit,l.hours,l.actualCount));}
for(const f of S.realLessonFeedbacks){assert(cids.has(f.course));assert(S.realLessons.some(l=>l.id===f.lesson));}
assert(!S.realTeachers.some(t=>['无所谓','未找到','0',''].includes(t.name)),'junk names dropped');
// Store loads the real data on the bumped storage keys; server seed inserts it without overwriting.
const store=readFileSync('lib/nexus/store.tsx','utf8');
assert(store.includes("projects:'nexus.demo.projects.v3'")&&store.includes('readList(STORAGE_KEYS.opsCourses,realCourses)')&&store.includes("'nexus.demo.projects.v2'"));
const seed=readFileSync('server/seed.ts','utf8');
assert(seed.includes('seedRealData')&&seed.includes('onConflictDoNothing'));
// 开始/结束时间 validation + teacher list.
assert.equal(O.timeRangeIssue('14:00','15:30'),null);assert.equal(O.timeRangeIssue('15:00','14:00'),'结束时间需晚于开始时间');assert.equal(O.timeRangeIssue('15:00','15:00'),'结束时间需晚于开始时间');assert.equal(O.timeRangeIssue('','15:00'),'请填写开始时间');
assert.equal(O.durationLabel('14:00','15:30'),'1.5 小时');assert.equal(O.durationLabel('14:00','16:00'),'2 小时');assert.equal(O.durationLabel('14:00','14:45'),'45 分钟');
assert.deepEqual(O.teacherNames([{id:'1',name:'Dora',note:'',active:true},{id:'2',name:'停用',note:'',active:false},{id:'3',name:'许瑾',note:'',active:true}],[{name:'许瑾',active:true},{name:'离职',active:false}],'旧老师'),['许瑾','Dora','旧老师']);
const mod=readFileSync('components/nexus/modules.tsx','utf8');
assert(mod.includes('<TeacherPicker value={teacher} onChange={setTeacher}/>')&&mod.includes('<ScheduleFields onChange={setSched}/>')&&mod.includes("time:first.start+'–'+first.end"));
assert(readFileSync('components/nexus/schedule.tsx','utf8').includes('aria-label="结束时间"'));
assert(!mod.includes('开始时间（课程时长 1 小时）'));
assert(readFileSync('components/nexus/admin.tsx','utf8').includes("{ id: 'teachers', label: '授课老师'"));
// 首次登录改密可跳过，本次会话有效，下次登录再提醒。
assert(readFileSync('components/nexus/password.tsx','utf8').includes('稍后修改'));
assert(store.includes('sessionStorage.setItem(PW_LATER_KEY')&&/const login=[\s\S]{0,600}clearPwLater\(\)/.test(store));
assert(readFileSync('app/page.tsx','utf8').includes('s.user?.mustChangePassword&&!s.passwordDeferred'));
console.log('Real data: 12 projects, 76 courses, 38 teachers, 5 Oct+ lessons, 4 feedbacks; integrity, time range, teacher picker and password skip passed.');
