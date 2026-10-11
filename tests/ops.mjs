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
const rec=(id,ops,date,amount,hours=2)=>({id,course:'c',date,hours,students:null,opsTeacher:ops,rate:15,unit:'hour',amount,note:'',createdBy:ops});
const L=[rec('1','xujin@nexus.local','2026-10-02',30),rec('2','xujin@nexus.local','2026-10-09',22.5,1.5),rec('3','XUJIN@nexus.local','2026-09-30',30),rec('4','fangyanqi@nexus.local','2026-10-03',48)];
assert.deepEqual(O.monthAllowance(L,'xujin@nexus.local','2026-10'),{amount:52.5,hours:3.5,count:2});
assert.deepEqual(O.monthAllowance(L,'zhangjiejia@nexus.local','2026-10'),{amount:0,hours:0,count:0});
assert.deepEqual(O.summarizeByTeacher(L.filter(r=>O.monthOf(r.date)==='2026-10')).map(x=>[x.opsTeacher,x.amount,x.count]),[['xujin@nexus.local',52.5,2],['fangyanqi@nexus.local',48,1]]);
assert.deepEqual(O.visibleLessons(L,'ops','xujin@nexus.local').map(r=>r.id),['1','2','3']);
assert.equal(O.visibleLessons(L,'superadmin','zhangjiejia@nexus.local').length,4);
assert.equal(O.visibleLessons(L,'sales','sales@nexus.demo').length,0);
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

// API gating wiring.
const app=readFileSync('server/app.ts','utf8');
for(const s of ["app.get('/admin/users'","app.post('/admin/users'","app.patch('/admin/users/:id'","reset-password","app.post('/auth/change-password'","app.delete('/:collection/:id'","canManageSystem(user.role)","canEditOwned(user.role, user.email","computeAllowance(rate, unit"])assert(app.includes(s),s);
const page=readFileSync('app/page.tsx','utf8');
assert(page.includes("['lessons','课时记录'")&&page.includes("['lesson-feedback','课情反馈'")&&page.includes("['admin','系统管理'")&&page.includes("canManageSystem(s.role)?['admin']"));
assert(readFileSync('components/nexus/admin.tsx','utf8').includes("if (!canManageSystem(s.role)) return"));
assert(readFileSync('components/nexus/dashboard.tsx','utf8').includes("'当月教务津贴'")&&readFileSync('components/nexus/dashboard.tsx','utf8').includes('stats-grid five'));
console.log('Ops: allowance standards and calculation, monthly summary, visibility, CSV import, empty seeds, schema/migration and role gating passed.');
