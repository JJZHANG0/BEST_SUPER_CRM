import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const O=await load('lib/nexus/ops.ts');

// 教务津贴标准 seeded from the reference table.
const T=O.defaultClassTypes;
assert.equal(T.length,12);
const byName=n=>T.find(t=>t.name.includes(n));
assert.deepEqual([byName('线上1-2人').rate,byName('线上3-5人').rate,byName('线上6人及以上').rate,byName('线下1-2人').rate,byName('线下3-5人').rate,byName('线下6人及以上').rate],[10,15,3,15,25,5]);
assert.equal(byName('线上6人及以上').unit,'person_hour');assert.equal(byName('线下6人及以上').unit,'person_hour');
assert.deepEqual(['部分教务工作2','部分教务工作3','线下8人班型','线下7人班型','线下11人班型','线下6人班型'].map(n=>[byName(n).rate,byName(n).unit]),[[2,'hour'],[3,'hour'],[40,'hour'],[35,'hour'],[55,'hour'],[30,'hour']]);

// Allowance per record.
assert.equal(O.computeAllowance(15,'hour',2),30);
assert.equal(O.computeAllowance(15,'hour',1.5,9),22.5,'per-hour ignores head count');
assert.equal(O.computeAllowance(3,'person_hour',2,8),48);
assert.equal(O.computeAllowance(5,'person_hour',1.5,7),52.5);
assert.equal(O.computeAllowance(5,'person_hour',2,null),0,'per-person needs students');
assert.equal(O.computeAllowance(40,'session',3,8),40,'flat amount per record');
assert.equal(O.computeAllowance(10,'hour',-1),0);
assert.equal(O.needsStudents('person_hour'),true);assert.equal(O.needsStudents('hour'),false);

// Monthly summary + visibility.
const rec=(id,ops,date,amount,hours=2)=>({id,course:'c',date,hours,expectedCount:null,actualCount:null,opsTeacher:ops,rate:15,unit:'hour',amount,note:'',createdBy:ops});
const L=[rec('1','xujin@nexus.local','2026-10-02',30),rec('2','xujin@nexus.local','2026-10-09',22.5,1.5),rec('3','XUJIN@nexus.local','2026-09-30',30),rec('4','fangyanqi@nexus.local','2026-10-03',48)];
assert.deepEqual(O.monthAllowance(L,'xujin@nexus.local','2026-10'),{amount:52.5,hours:3.5,count:2});
assert.deepEqual(O.monthAllowance(L,'zhangjiejia@nexus.local','2026-10'),{amount:0,hours:0,count:0});
assert.deepEqual(O.summarizeByTeacher(L.filter(r=>O.monthOf(r.date)==='2026-10')).map(x=>[x.opsTeacher,x.amount,x.count]),[['xujin@nexus.local',52.5,2],['fangyanqi@nexus.local',48,1]]);
assert.deepEqual(O.visibleLessons(L,{role:'ops'},'xujin@nexus.local').map(r=>r.id),['1','2','3']);
assert.equal(O.visibleLessons(L,{role:'superadmin',leader:true},'zhangjiejia@nexus.local').length,4,'部门负责人 sees everyone');
assert.equal(O.visibleLessons(L,{role:'superadmin',leader:false},'chengxueqing@nexus.local').length,0,'other superadmins only see their own');
assert.equal(O.visibleLessons(L,{role:'sales'},'sales@nexus.demo').length,0);
assert.equal(O.currentMonth(new Date('2026-10-31T17:30:00Z')),'2026-11','Shanghai month boundary');
assert.equal(O.today(new Date('2026-10-11T16:30:00Z')),'2026-10-12');

// Dates, class-type matching, CSV.
assert.equal(O.parseDate('2025年9月6日'),'2025-09-06');assert.equal(O.parseDate('2026/1/16'),'2026-01-16');assert.equal(O.parseDate('2025-09-06'),'2025-09-06');assert.equal(O.parseDate('9月6日'),'');
assert.equal(O.matchClassType('2. 线上3-5人',T)?.id,'CT02');assert.equal(O.matchClassType('线下6人班型',T)?.id,'CT12');assert.equal(O.matchClassType('线下6人及以上',T)?.id,'CT06');assert.equal(O.matchClassType('线上100人',T),undefined);
assert.deepEqual(O.parseCsv('\uFEFFa,b\r\n"x, y","he said ""hi"""\n\n'),[['a','b'],['x, y','he said "hi"']]);
assert.deepEqual(O.parseCsv('a\tb\n1\t2'),[['a','b'],['1','2']]);
assert(O.toCsv([['课程','金额'],['A,1',2]]).startsWith('\uFEFF课程,金额\r\n"A,1",2'));
assert.equal(O.statusFromDates('2026-10-20','2026-12-01','2026-10-11'),'未开始');assert.equal(O.statusFromDates('2025-09-06','2026-01-16','2026-10-11'),'已结束');

// Course import with the spreadsheet's columns.
let n=0;const newId=p=>`${p}-${++n}`;
const staff=[{email:'zhangjiejia@nexus.local',name:'张捷嘉'},{email:'chengxueqing@nexus.local',name:'程雪晴'}];
const csv=['项目编号,课程编号,课程状态,课程名称,班级类型,津贴标准,授课老师,教务老师,起始日期,终止日期',
 'COND2025001,COND02501-11A,已结束,COND 星跃 商业(11月线上小组课),2. 线上3-5人,¥15,陈佳浩Venti,张捷嘉,2025年9月6日,2026年1月16日',
 'COND2025001,COND02504-11A,,COND 胎心 商业(11月线上小组课),2. 线上3-5人,¥15,董之恒,程雪晴,2025年9月6日,2026年1月16日',
 'COND2025001,COND02504-11B,已结束,COND 胎心 工程,未知班型,¥15,Dora,程雪晴,2025年9月6日,2026年1月16日',
 'COND2025001,COND02505-11A,已结束,COND 停车,2. 线上3-5人,¥15,穆加,路人甲,2025年9月6日,2026年1月16日',
 'COND2025001,COND02501-11A,已结束,重复,2. 线上3-5人,¥15,x,张捷嘉,,'].join('\n');
const existing=[{id:'OC-old',code:'COND02504-11A',project:'P-x',name:'旧',status:'进行中',classType:'CT01',teacher:'',opsTeacher:'',startDate:'',endDate:''}];
const r=O.importCourses(csv,{classTypes:T,projects:[],courses:existing,staff,newId,today:'2026-10-11'});
assert.equal(r.created,1);assert.equal(r.updated,1);
assert.equal(r.projects.length,1);assert.equal(r.projects[0].code,'COND2025001');
const c1=r.courses.find(c=>c.code==='COND02501-11A');
assert.deepEqual([c1.classType,c1.opsTeacher,c1.startDate,c1.endDate,c1.status,c1.project],['CT02','zhangjiejia@nexus.local','2025-09-06','2026-01-16','已结束',r.projects[0].id]);
const c2=r.courses.find(c=>c.code==='COND02504-11A');assert.equal(c2.id,'OC-old');assert.equal(c2.status,'已结束','status derived from dates when blank');
assert.deepEqual(r.issues.map(i=>i.line),[4,5,6]);
assert.equal(O.importCourses('课程编号\nX',{classTypes:T,projects:[],courses:[],staff,newId}).issues[0].line,1,'missing columns reported');

// Seeds are empty-but-real; reference data kept.
const D=await load('lib/nexus/data.ts');
for(const k of ['teams','students','courses','feedbacks','resources','announcements','enrollments'])assert.equal(D[k].length,0,`${k} seed is empty`);
assert.equal(D.programs.length,8);
const store=readFileSync('lib/nexus/store.tsx','utf8');
assert(store.includes("'nexus.demo.todos.v2'")&&store.includes("'nexus.demo.lessons.v2'")&&store.includes("'nexus.demo.todos.v1'"),'storage keys bumped, legacy keys cleared');
const seed=readFileSync('server/seed.ts','utf8');
assert(!seed.includes('demo.students')&&!seed.includes('seedTodos')&&seed.includes('defaultClassTypes'));
assert(!readFileSync('lib/nexus/recruitment.ts','utf8').includes('示例·'));

// Schema + migration for the new tables.
const schema=readFileSync('db/schema.ts','utf8');
for(const t of ['class_types','projects','ops_courses','lesson_records','lesson_feedbacks'])assert(schema.includes(`pgTable('${t}'`),t);
const mig=readFileSync('drizzle/0002_ops_lessons_allowance.sql','utf8');
for(const t of ['class_types','projects','ops_courses','lesson_records','lesson_feedbacks'])assert(mig.includes(`CREATE TABLE "${t}"`),t);
assert(mig.includes('"must_change_password" boolean DEFAULT false NOT NULL'));
assert(JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8')).entries.some(e=>e.tag==='0002_ops_lessons_allowance'));

// Username login (migration 0003): column, case-insensitive unique index, backfill; API accepts username or email.
const m3=readFileSync('drizzle/0003_users_username.sql','utf8');
assert(m3.includes('ADD COLUMN "username" text')&&m3.includes('lower("username")')&&m3.includes('UPDATE "users"'));
assert(JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8')).entries.some(e=>e.tag==='0003_users_username'));
assert(schema.includes("username: text('username')")&&schema.includes('users_username_lower_idx'));
const appSrc=readFileSync('server/app.ts','utf8');
assert(appSrc.includes('body?.login')&&appSrc.includes('lower(${schema.users.username})')&&appSrc.includes('该用户名已被使用'));
assert(readFileSync('components/nexus/login.tsx','utf8').includes('用户名（姓名）'));

// API gating wiring.
const app=readFileSync('server/app.ts','utf8');
for(const s of ["app.get('/admin/users'","app.post('/admin/users'","app.patch('/admin/users/:id'","reset-password","app.post('/auth/change-password'","app.delete('/:collection/:id'","canManageSystem(user.role)","canEditOwned(user, user.email","computeAllowance(rate, unit"])assert(app.includes(s),s);
const page=readFileSync('app/page.tsx','utf8');
assert(page.includes("['lessons','课时记录'")&&page.includes("['lesson-feedback','课情反馈'")&&page.includes("['admin','系统管理'")&&page.includes("canManageSystem(s.role)?['forms','admin']"));
assert(readFileSync('components/nexus/admin.tsx','utf8').includes("if (!canManageSystem(s.role)) return"));
assert(readFileSync('components/nexus/dashboard.tsx','utf8').includes("'当月教务津贴'")&&readFileSync('components/nexus/dashboard.tsx','utf8').includes('stats-grid five'));

// 应到 / 实到人数: legacy migration, roster-based expected attendance, 到课情况 text, course combobox filter.
assert.deepEqual(O.normalizeLesson({id:'x',course:'c',students:6}),{id:'x',course:'c',expectedCount:null,actualCount:6},'legacy students → actualCount');
assert.deepEqual(O.normalizeLesson({id:'x',course:'c',students:null}),{id:'x',course:'c',expectedCount:null,actualCount:null});
assert.deepEqual(O.normalizeLesson({id:'x',course:'c',expectedCount:6,actualCount:5,students:9}),{id:'x',course:'c',expectedCount:6,actualCount:5},'new fields win, idempotent');
assert.equal(O.teamCore('TEAM   「清澜环」'),'清澜环');assert.equal(O.teamCore('TEAM 埙'),'埙');
const roster={courses:[{code:'SCHED-1',team:'T3'}],
  teams:[{id:'T1',name:'TEAM 「云驿」',program:'conrad'},{id:'T2',name:'TEAM 「魔术」',program:'conrad'},{id:'T3',name:'TEAM 哨兵',program:'bpa'},{id:'T4',name:'TEAM 「云驿」',program:'ctb'}],
  enrollments:[{student:'a',team:'T1',status:'进行中'},{student:'b',team:'T1',status:'进行中'},{student:'c',team:'T1',status:'已退费'},{student:'d',team:'T2',status:'进行中'},{student:'e',team:'T3',status:'进行中'},{student:'z',team:'T4',status:'进行中'}],
  students:[{id:'a',team:'T1',status:'进行中'},{id:'f',team:'T1',status:'进行中'},{id:'g',team:'T3',status:'进行中'}],
  classTypes:T};
const ea=O.expectedAttendance({code:'WS1',name:'康莱德 「航空」TEAM 云驿 第一阶段',classType:'CT02'},roster);
assert.deepEqual([ea.count,ea.source],[3,'team'],'distinct active students of the conrad 云驿 team (enrollments ∪ students.team, 退费 excluded, other programme ignored)');
assert.equal(O.expectedAttendance({code:'WS2',name:'康莱德 「网络」TEAM 魔术墙 第二阶段',classType:'CT02'},roster).count,1,'team core prefix (魔术 → 魔术墙)');
assert.deepEqual((({count,source})=>[count,source])(O.expectedAttendance({code:'sched-1',name:'BPA 决赛课程',classType:'CT02'},roster)),[2,'schedule'],'timetable course with the same 课程编号 links the team');
assert.deepEqual((({count,source})=>[count,source])(O.expectedAttendance({code:'X',name:'线下课',classType:'CT09'},roster)),[8,'classType'],'fixed class size fallback');
const unk=O.expectedAttendance({code:'X',name:'VC 申请辅导',classType:'CT02'},roster);assert.deepEqual([unk.count,unk.source],[null,'unknown']);assert.match(unk.hint,/实到人数/);
assert.equal(O.expectedAttendance(undefined,roster).count,null);
assert.equal(O.classTypeSize('线下8人班型'),8);assert.equal(O.classTypeSize('2. 线上3-5人班型'),null);assert.equal(O.classTypeSize('6. 线下6人及以上班型'),null);
assert.equal(O.attendanceText(5,6),'5/6 到课');assert.equal(O.attendanceText(6,6),'6/6 全勤');assert.equal(O.attendanceText(5,null),'5 人到课');assert.equal(O.attendanceText(null,6),'');
assert.equal(O.computeAllowance(3,'person_hour',2,5),30,'allowance uses 实到人数');
const cs=[{id:'1',code:'WS2026019-01',name:'2026 BPA商业全能挑战赛- 潘厚安',teacher:'潘厚安',project:'P1'},{id:'2',code:'WS2026017-1-22',name:'康莱德 「航空」TEAM 云驿 第一阶段',teacher:'李进坚',project:'P2'},{id:'3',code:'AB-019',name:'BPA 决赛课程',teacher:'张捷嘉',project:'P1'}];
const pl=id=>({P1:'WS2026019 BPA',P2:'WS2026017 康莱德'}[id]);
assert.deepEqual(O.filterCourses(cs,'',pl).map(c=>c.id),['1','2','3']);
assert.deepEqual(O.filterCourses(cs,'云驿',pl).map(c=>c.id),['2'],'name');
assert.deepEqual(O.filterCourses(cs,'李进坚',pl).map(c=>c.id),['2'],'teacher');
assert.deepEqual(O.filterCourses(cs,'康莱德',pl).map(c=>c.id),['2'],'project label');
assert.deepEqual(O.filterCourses(cs,'019',pl).map(c=>c.id),['1','3'],'code contains');
assert.deepEqual(O.filterCourses(cs,'bpa 张',pl).map(c=>c.id),['3'],'all terms must match');
assert.deepEqual(O.filterCourses(cs,'ws2026019',pl).map(c=>c.id),['1','3'],'code prefix first, then project match');
// Both persistence paths carry expectedCount / actualCount; migration copies the old head count.
const m8=readFileSync('drizzle/0008_lesson_attendance.sql','utf8');
assert(m8.includes('ADD COLUMN IF NOT EXISTS "expected_count" integer')&&m8.includes('ADD COLUMN IF NOT EXISTS "actual_count" integer')&&m8.includes('SET "actual_count" = "students"'));
assert(JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8')).entries.some(e=>e.tag==='0008_lesson_attendance'));
assert(schema.includes("expectedCount: integer('expected_count')")&&schema.includes("actualCount: integer('actual_count')")&&!schema.includes("students: integer('students')"));
const cols=readFileSync('server/collections.ts','utf8');assert(cols.includes('expectedCount: z.number()')&&cols.includes('actualCount: z.number()'));
const api=readFileSync('server/app.ts','utf8');assert(api.includes('normalizeLesson(body)')&&api.includes('Number(data.actualCount) > 0')&&api.includes('data.actualCount as number | null'));
assert(store.includes('.map(normalizeLesson)'),'localStorage + bootstrap lessons migrated');
const opsUi=readFileSync('components/nexus/ops-pages.tsx','utf8');
assert(opsUi.includes('<CourseCombobox')&&opsUi.includes('应到人数')&&opsUi.includes('实到人数')&&opsUi.includes('attendanceText(n, expected)'));
assert(/<FormField label="本次课程内容"><textarea[^>]*rows=\{6\}/.test(opsUi)&&/<FormField label="学生布置"><textarea[^>]*rows=\{6\}/.test(opsUi),'课程内容 and 学生布置 same taller size');
assert(opsUi.includes('lessonFeedbackRequested(withFb, fb, attTouched)')&&opsUi.includes('noValidate')&&opsUi.includes('课程回放链接')&&opsUi.includes('复制课程反馈'),'auto 到课情况 does not block save; replay link + copy feedback');
assert(schema.includes("replayUrl: text('replay_url')")&&cols.includes('replayUrl: s(2000).optional()'));
assert(readFileSync('drizzle/0022_lesson_replay_url.sql','utf8').includes('ADD COLUMN IF NOT EXISTS "replay_url"'));
assert(JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8')).entries.some(e=>e.tag==='0022_lesson_replay_url'));
const cc=readFileSync('components/nexus/course-combobox.tsx','utf8');assert(cc.includes('role="combobox"')&&cc.includes('aria-activedescendant')&&cc.includes("'ArrowDown'")&&cc.includes("'Escape'"));
const css=readFileSync('app/globals.css','utf8');
assert(css.includes('.ops-table .num{text-align:left')&&css.includes('.ops-table [data-slot=table-head],.ops-table [data-slot=table-cell]:not(.row-actions){text-align:left}'),'ops tables left-aligned');
assert(css.includes('clip-path:inset(-60% -60% var(--husky-clip,0px) -60%)')&&readFileSync('components/nexus/brand.tsx','utf8').includes("'--husky-clip'"),'husky peeks from behind the tab');

// Coach portal roster scope: ops course TEAM… → teams + prefer teams.teacher.
assert.equal(O.canonicalTeacherName('郝震焜'),'郝震昆');
assert(O.sameTeacherName('郝震焜','郝震昆'));
assert(O.sameTeacherName('李进坚','李进坚'));
assert(!O.sameTeacherName('李进坚','董之恒'));
const scopeTeams=[{id:'T1',name:'TEAM 「云驿」',program:'conrad',teacher:'程雪晴'},{id:'T2',name:'TEAM「听障」',program:'conrad',teacher:'张雪航'},{id:'T3',name:'TEAM 「蓝域」',program:'conrad',teacher:'王皓萱'}];
const scopeOps=[{id:'OC1',code:'A',name:'康莱德 「航空」TEAM 云驿 第一阶段',teacher:'李进坚'},{id:'OC2',code:'B',name:'康莱德 「网络」TEAM 听障 第一阶段',teacher:'董之恒'},{id:'OC3',code:'C',name:'康莱德「水源」TEAM 蓝域 第一阶段',teacher:'王皓萱'}];
const scopeEnr=[{student:'s1',team:'T1',status:'进行中'},{student:'s2',team:'T2',status:'进行中'},{student:'s3',team:'T3',status:'进行中'},{student:'s4',team:'T1',status:'已退费'}];
const scopeStu=[{id:'s1',team:'T1',status:'进行中'},{id:'s2',team:'T2',status:'进行中'},{id:'s3',team:'T3',status:'进行中'},{id:'sx',team:'T9',status:'进行中'}];
const sc=O.teacherRosterScope('李进坚',{opsCourses:scopeOps,teams:scopeTeams,enrollments:scopeEnr,students:scopeStu});
assert.deepEqual([...sc.teamIds].sort(),['T1']);
assert.deepEqual([...sc.studentIds].sort(),['s1','s4']);
assert.equal(sc.opsCourses.length,1);
const sc2=O.teacherRosterScope('王皓萱',{opsCourses:scopeOps,teams:scopeTeams,enrollments:scopeEnr,students:scopeStu});
assert.deepEqual([...sc2.teamIds].sort(),['T3'],'ops course + operational teams.teacher');
assert.deepEqual([...sc2.studentIds].sort(),['s3']);
const sc3=O.teacherRosterScope('郝震昆',{opsCourses:[{id:'OC',code:'X',name:'康莱德 「航空」TEAM 隼卫 第一阶段',teacher:'郝震焜'}],teams:[{id:'TH',name:'TEAM 「隼卫」',program:'conrad',teacher:'许瑾'}],enrollments:[],students:[]});
assert.deepEqual([...sc3.teamIds],['TH'],'alias 郝震焜→郝震昆 matches course teacher');
assert(readFileSync('server/app.ts','utf8').includes('teacherRosterScope')&&readFileSync('lib/nexus/store.tsx','utf8').includes('teacherRosterScope'),'API + Pages scope wired');


// 课时费用 + month lock helpers
assert.equal(O.LESSON_TEACHING_FEE_PER_HOUR, 150);
assert.equal(O.myLessonTeachingFee(0), 0);
assert.equal(O.myLessonTeachingFee(10), 1500);
assert.equal(O.myLessonTeachingFee(1.5), 225);
// 「我的课时费用」 counts 授课老师 === self only (跟课-only → 0)
const feeCourses = [{ id: 'C1', teacher: '李进圣' }, { id: 'C2', teacher: '程雪晴' }];
const feeRows = [
  { id: 'L1', date: '2026-10-10', course: 'C1', hours: 2, rate: 30, unit: 'hour', amount: 60, opsTeacher: 'cheng@x', teacher: '李进圣', expectedCount: null, actualCount: null, note: '', createdBy: 'cheng@x' },
  { id: 'L2', date: '2026-10-11', course: 'C2', hours: 2, rate: 30, unit: 'hour', amount: 60, opsTeacher: 'cheng@x', teacher: '程雪晴', expectedCount: null, actualCount: null, note: '', createdBy: 'cheng@x' },
  { id: 'L3', date: '2026-10-11', course: 'C1', hours: 4, rate: 30, unit: 'hour', amount: 120, opsTeacher: 'cheng@x', teacher: '', expectedCount: null, actualCount: null, note: '', createdBy: 'cheng@x' },
];
assert.equal(O.myTeachingLessonHours(feeRows, feeCourses, '程雪晴', '2026-10'), 2, 'only self as 授课老师');
assert.equal(O.myLessonTeachingFee(O.myTeachingLessonHours(feeRows, feeCourses, '程雪晴', '2026-10')), 300);
assert.equal(O.myTeachingLessonHours(feeRows, feeCourses, '程雪晴', '2026-09'), 0);
assert.equal(O.myLessonTeachingFee(O.myTeachingLessonHours(feeRows, feeCourses, '程雪晴', '2026-09')), 0);
assert.equal(O.RED_PACKET_YUAN_PER_DAY, 2.4);
assert.equal(O.redPacketFromUsageMs(0), 0);
assert.equal(O.redPacketFromUsageMs(24 * 3600_000), 2.4);
assert.equal(O.redPacketFromUsageMs(12 * 3600_000), 1.2);
assert.equal(O.isLessonMonth('2026-10'), true);
assert.equal(O.isLessonMonth('2026-13'), false);
assert.equal(O.isLessonMonthLocked(['2026-10'], '2026-10-11'), true);
assert.equal(O.isLessonMonthLocked(['2026-10'], '2026-09-30'), false);
assert.equal(O.canEditLockedLessonMonth({ name: '张捷嘉', leader: true }), true);
assert.equal(O.canEditLockedLessonMonth({ name: '程雪晴', email: 'chengxueqing@nexus.local' }), false);
assert.equal(O.canEditLockedLessonMonth({ name: 'x', email: 'zhangjiejia@nexus.local' }), true);
assert(readFileSync('drizzle/0015_lesson_month_locks.sql','utf8').includes('lesson_month_locks'));
assert(readFileSync('db/schema.ts','utf8').includes('lessonMonthLocks'));
assert(readFileSync('server/app.ts','utf8').includes('lesson-month-locks'));
assert(readFileSync('server/app.ts','utf8').includes("app.delete('/lesson-month-locks/:month'") && readFileSync('server/app.ts','utf8').includes('只有张捷嘉可以驳回解锁'));
assert(readFileSync('components/nexus/ops-pages.tsx','utf8').includes('驳回解锁') && readFileSync('components/nexus/ops-pages.tsx','utf8').includes('unlockLessonMonth'));
assert(readFileSync('lib/nexus/store.tsx','utf8').includes('unlockLessonMonth'));
assert(readFileSync('components/nexus/ops-pages.tsx','utf8').includes('跟课合计'));
assert(readFileSync('components/nexus/ops-pages.tsx','utf8').includes('我的课时费用'));
assert(readFileSync('components/nexus/ops-pages.tsx','utf8').includes('myTeachingLessonHours'));
assert(readFileSync('components/nexus/ops-pages.tsx','utf8').includes('MonthConfirmHold'));
assert(readFileSync('components/nexus/ops-pages.tsx','utf8').includes('course-cell'));
assert(readFileSync('app/globals.css','utf8').includes('course-stack'));
// workbench cards: rename + red packet + weather chrome
const whCard = readFileSync('components/nexus/work-hours-card.tsx','utf8');
assert(whCard.includes('本月使用时长') && !whCard.includes('本月累计工时'));
assert(whCard.includes('本月红包提现') && whCard.includes('牛马不能白当') && whCard.includes('JJ老师'));
const dashSrc = readFileSync('components/nexus/dashboard.tsx','utf8');
assert(dashSrc.includes('RedPacketCard') && dashSrc.includes('useMonthlyWorkHours'));
assert(!dashSrc.includes("'活跃队伍'"), 'workbench no longer shows 活跃队伍 card');
const gcss = readFileSync('app/globals.css','utf8');
assert(gcss.includes('.welcome-weather{') && gcss.includes('background:transparent'), 'weather transparent');
assert(gcss.includes('red-packet-tip'));

console.log('Ops: allowance standards and calculation, monthly summary, visibility, CSV import, empty seeds, schema/migration and role gating passed.');
