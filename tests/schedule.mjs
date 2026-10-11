// 课程排课: weekly recurrence, manual sessions, occurrences (今日课程 / 本周课程), timetable layout + PDF export;
// 课时记录 + 学情反馈 in one form; 授课老师 hours; leader-only visibility of others' 课时 / 津贴.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const S=await load('lib/nexus/schedule.ts');
const O=await load('lib/nexus/ops.ts');
const P=await load('lib/nexus/pdf.ts');

// Calendar helpers (2026-10-12 is a Monday).
assert.equal(S.isoWeekday('2026-10-12'),1);assert.equal(S.isoWeekday('2026-10-18'),7);
assert.equal(S.mondayOf('2026-10-18'),'2026-10-12');assert.equal(S.addDays('2026-10-31',1),'2026-11-01');
assert.deepEqual(S.weekOf('2026-10-14'),['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18']);
assert.equal(S.isDate('2026-02-30'),false);assert.equal(S.isDate('2026-02-28'),true);

// Weekly recurrence: fixed number of sessions.
const rule={startDate:'2026-10-13',weekdays:[2,4],start:'19:00',end:'20:30',count:5};
assert.deepEqual(S.weeklyDates(rule),{dates:['2026-10-13','2026-10-15','2026-10-20','2026-10-22','2026-10-27'],issue:null});
// Start date on a non-selected weekday: first session is the next matching day.
assert.deepEqual(S.weeklyDates({...rule,startDate:'2026-10-14',count:2}).dates,['2026-10-15','2026-10-20']);
// Until an end date (inclusive), across a month boundary.
assert.deepEqual(S.weeklyDates({...rule,weekdays:[6],count:null,until:'2026-11-07'}).dates,['2026-10-17','2026-10-24','2026-10-31','2026-11-07']);
// Both: whichever comes first.
assert.deepEqual(S.weeklyDates({...rule,weekdays:[1,3,5],count:10,until:'2026-10-16'}).dates,['2026-10-14','2026-10-16']);
assert.equal(S.weeklyDates({...rule,weekdays:[4,4,'2']}).dates.length,5,'weekday duplicates / strings normalised');
// Validation.
assert.equal(S.weeklyDates({...rule,weekdays:[]}).issue,'请至少选择一个上课日（周一至周日）');
assert.equal(S.weeklyDates({...rule,startDate:''}).issue,'请选择开始日期');
assert.equal(S.weeklyDates({...rule,end:'18:00'}).issue,'结束时间需晚于开始时间');
assert.equal(S.weeklyDates({...rule,count:null,until:null}).issue,'请填写上课次数或截止日期');
assert.match(S.weeklyDates({...rule,count:0}).issue,/上课次数需在 1–200/);
assert.match(S.weeklyDates({...rule,count:S.MAX_SESSIONS+1}).issue,/上课次数/);
assert.equal(S.weeklyDates({...rule,count:null,until:'2026-10-01'}).issue,'截止日期不能早于开始日期');
assert.equal(S.weeklyDates({...rule,weekdays:[1],count:null,until:'2026-10-18'}).issue,'所选日期范围内没有符合的上课日');
assert.equal(S.weeklyDates({...rule,weekdays:[1,2,3,4,5,6,7],count:S.MAX_SESSIONS}).dates.length,S.MAX_SESSIONS);
assert.match(S.weeklyDates({...rule,weekdays:[1,2,3,4,5,6,7],count:null,until:'2027-12-31'}).issue,/最多排 200 节/);
assert.deepEqual(S.slotsFromRule({...rule,count:1},'A302'),[{date:'2026-10-13',start:'19:00',end:'20:30',location:'A302'}]);

// Manual sessions.
assert.equal(S.manualIssue([]),'请至少添加一节课');
assert.equal(S.manualIssue([{date:'2026-10-20',start:'09:00',end:'10:00'},{date:'',start:'09:00',end:'10:00'}]),'第 2 节：请选择日期');
assert.equal(S.manualIssue([{date:'2026-10-20',start:'10:00',end:'09:00'}]),'第 1 节：结束时间需晚于开始时间');
assert.match(S.manualIssue([{date:'2026-10-20',start:'09:00',end:'10:00'},{date:'2026-10-20',start:'09:00',end:'11:00'}]),/时间重复/);
assert.equal(S.manualIssue([{date:'2026-10-21',start:'09:00',end:'10:00'},{date:'2026-10-20',start:'14:00',end:'15:00'}]),null);
let n=0;const ss=S.buildSessions('C1',[{date:'2026-10-21',start:'09:00',end:'10:00'},{date:'2026-10-20',start:'14:00',end:'15:00',location:' 腾讯会议 '}],()=>'S'+(++n));
assert.deepEqual(ss,[{id:'S1',course:'C1',date:'2026-10-20',start:'14:00',end:'15:00',location:'腾讯会议'},{id:'S2',course:'C1',date:'2026-10-21',start:'09:00',end:'10:00',location:''}]);

// Occurrences: sessions replace the course's own date; courses without sessions keep their single meeting.
const courses=[{id:'C1',name:'BPA 商业计划',program:'bpa',teacher:'Dora',date:'2026-10-20',time:'14:00–15:00',status:'已安排',code:'BPA-01',location:'A302'},{id:'C2',name:'科研写作',program:'prime',teacher:'许瑾',date:'2026-10-21',time:'19:00–20:00',status:'已安排'},{id:'C3',name:'无日期',program:'x',teacher:'',date:'',time:'',status:''}];
const occ=S.occurrences(courses,ss);
assert.deepEqual(occ.map(o=>[o.course.id,o.date,o.start,o.end,o.location]),[['C1','2026-10-20','14:00','15:00','腾讯会议'],['C1','2026-10-21','09:00','10:00','A302'],['C2','2026-10-21','19:00','20:00','']]);
assert.equal(S.onDate(occ,'2026-10-21').length,2,'今日课程 counts sessions');
assert.equal(S.inWeek(occ,'2026-10-25').length,3,'本周课程 counts sessions');
assert.equal(S.inWeek(occ,'2026-10-26').length,0);

// Timetable layout: lanes for overlaps, hour range, colours, legend, labels.
const over=[...occ,{key:'x',course:{...courses[1],id:'C9',name:'重叠课'},session:null,date:'2026-10-21',start:'09:30',end:'11:00',location:''}];
const colors=S.colorMap(over);assert.equal(new Set(colors.values()).size,3);
const wk=S.timetableWeek(over,'2026-10-19',colors);
assert.equal(wk.days[0],'2026-10-19');assert.equal(wk.blocks.length,4);assert.equal(wk.fromMin,8*60);assert.equal(wk.toMin,20*60);
const wed=wk.blocks.filter(b=>b.day===2&&b.startMin<12*60);assert.deepEqual(wed.map(b=>[b.lane,b.lanes]),[[0,2],[1,2]]);
const kx=wk.blocks.find(b=>b.title==='科研写作');assert.deepEqual([kx.lane,kx.lanes],[0,1],'non-overlapping block has its own full lane');
assert.equal(wk.blocks.find(b=>b.code==='BPA-01').time,'14:00–15:00');
assert.deepEqual(S.legend(occ,colors).map(l=>[l.title,l.count]).sort(),[['BPA 商业计划',2],['科研写作',1]]);
assert.deepEqual(S.weekStarts('2026-10-21',3),['2026-10-19','2026-10-26','2026-11-02']);
assert.equal(S.weekRangeLabel('2026-10-19'),'2026年10月19日 – 10月25日');assert.equal(S.weekRangeLabel('2026-12-28'),'2026年12月28日 – 2027年1月3日');
assert.equal(S.termLabel('2026-10-19'),'2026–2027 秋季学期');assert.equal(S.termLabel('2027-03-01'),'2026–2027 春季学期');

// PDF writer: valid header, one page per image, xref offsets point at objects.
const jpeg=new Uint8Array([0xFF,0xD8,0xFF,0xD9]);
const pdf=P.imagesToPdf([{jpeg,width:1600,height:1100},{jpeg,width:1600,height:1100}],{title:'课表'});
const txt=Buffer.from(pdf).toString('latin1');
assert(txt.startsWith('%PDF-1.'));assert(txt.trimEnd().endsWith('%%EOF'));
assert.equal((txt.match(/\/Type\s*\/Page\b/g)||[]).length,2);assert(/\/Count\s*2/.test(txt));assert(/\/DCTDecode/.test(txt));
const xref=Number(txt.match(/startxref\s+(\d+)/)[1]);assert.equal(txt.slice(xref,xref+4),'xref');
for(const m of txt.slice(xref).matchAll(/^(\d{10}) 00000 n/gm)){const off=Number(m[1]);assert.match(txt.slice(off,off+12),/^\d+ 0 obj/)}

// 课时记录 + 学情反馈 in one form.
const lesson={id:'L1',course:'C1',date:'2026-10-20',hours:1.5,expectedCount:5,actualCount:4,opsTeacher:'xujin@nexus.local',rate:15,unit:'hour',amount:22.5,note:'',createdBy:'xujin@nexus.local',teacher:'Dora'};
const empty={attendance:'',content:'',performance:'',issues:'',nextSteps:''};
assert.equal(O.feedbackDraftEmpty(empty),true);
assert.deepEqual(O.lessonWithFeedback({lesson,feedback:empty,withFeedback:true,newId:()=>'F1'}),{lesson,feedback:null,issue:null},'nothing filled: no feedback');
assert.equal(O.lessonWithFeedback({lesson,feedback:{...empty,content:'x'},withFeedback:false,newId:()=>'F1'}).feedback,null,'unticked: no feedback');
assert.match(O.lessonWithFeedback({lesson,feedback:{...empty,issues:'迟到'},withFeedback:true,newId:()=>'F1'}).issue,/本次课程内容/);
const made=O.lessonWithFeedback({lesson,feedback:{attendance:' 4/4 ',content:' 商业模式画布 ',performance:'积极',issues:'',nextSteps:'完成财务表'},withFeedback:true,newId:()=>'F1'});
assert.equal(made.issue,null);
assert.deepEqual(made.feedback,{id:'F1',course:'C1',lesson:'L1',date:'2026-10-20',attendance:'4/4',content:'商业模式画布',performance:'积极',issues:'',nextSteps:'完成财务表',opsTeacher:'xujin@nexus.local',createdBy:'xujin@nexus.local'});
const upd=O.lessonWithFeedback({lesson:{...lesson,date:'2026-10-21'},feedback:{...empty,content:'改'},withFeedback:true,existing:{...made.feedback,createdBy:'orig'},newId:()=>'NEW'});
assert.equal(upd.feedback.id,'F1','editing updates the linked feedback in place');assert.equal(upd.feedback.date,'2026-10-21');assert.equal(upd.feedback.createdBy,'orig');

// 授课老师 + per-teacher hours for the month (older records fall back to the course's teacher).
const rec=(id,ops,date,hours,teacher,course='C1')=>({id,course,date,hours,expectedCount:null,actualCount:null,opsTeacher:ops,rate:10,unit:'hour',amount:hours*10,note:'',createdBy:ops,...(teacher?{teacher}:{})});
const L=[rec('1','xujin@nexus.local','2026-10-02',2,'Dora'),rec('2','xujin@nexus.local','2026-10-09',1.5,'Kevin'),rec('3','xujin@nexus.local','2026-10-10',1,'','C2'),rec('4','fangyanqi@nexus.local','2026-10-03',3,'Dora'),rec('5','xujin@nexus.local','2026-09-30',5,'Dora')];
assert.equal(O.lessonTeacher(L[2],courses),'许瑾');assert.equal(O.lessonTeacher({course:'zz'},courses),'未填写');
const mine=O.visibleLessons(L,{role:'ops'},'xujin@nexus.local');
assert.deepEqual(O.hoursByLessonTeacher(mine,courses,'2026-10').map(x=>[x.teacher,x.hours,x.count]),[['Dora',2,1],['Kevin',1.5,1],['许瑾',1,1]],'only the viewer’s own records');
const all=O.visibleLessons(L,{role:'superadmin',leader:true},'zhangjiejia@nexus.local');
assert.deepEqual(O.hoursByLessonTeacher(all,courses,'2026-10')[0],{teacher:'Dora',hours:5,count:2,amount:50},'leader sees the whole team');

// Allowance visibility: superadmins / ops without the leader flag (程雪晴 superadmin, 张雪航 ops) only get their own.
assert.equal(O.visibleLessons(L,{role:'superadmin',leader:false},'chengxueqing@nexus.local').length,0);assert.equal(O.visibleLessons(L,{role:'ops',leader:false},'zhangxuehang@nexus.local').length,0);
assert.deepEqual(O.monthAllowance(L,'xujin@nexus.local','2026-10'),{amount:45,hours:4.5,count:3});
const opsPages=readFileSync('components/nexus/ops-pages.tsx','utf8');
assert(opsPages.includes('if (canSeeAllLessons(s.viewer))')&&opsPages.includes('monthAllowance(s.lessons, s.user?.email'),'dashboard 当月教务津贴: team total only for the leader');
assert(!opsPages.includes('超级管理员可查看全部老师'),'old superadmin-sees-all copy removed');

// API: bootstrap filters 课时 / 反馈 by the leader flag, writes check ownership with the whole user.
const app=readFileSync('server/app.ts','utf8');
assert(app.includes('const own = (r: Record<string, unknown>) => canSeeAllLessons(user) ||'));
assert(app.includes('lessons: lessons.filter(own), lessonFeedbacks: lessonFeedbacks.filter(own)'));
assert(app.includes("canEditOwned(user, user.email, String(data.opsTeacher))"));
assert(!/canSeeAllLessons\(user\.role\)|canAssignTodos\(user\.role\)|canReviewKpi\(user\.role\)|canFillKpi\(user\.role\)/.test(app),'permission helpers receive the user (leader flag), never a bare role');
assert(/leader: row\.leader === true/.test(app));
const mig=readFileSync('drizzle/0006_leader_sessions_lesson_teacher.sql','utf8');
assert(mig.includes('CREATE TABLE "course_sessions"')&&mig.includes('ADD COLUMN "leader" boolean DEFAULT false NOT NULL')&&mig.includes('ADD COLUMN "teacher" text')&&mig.includes(`UPDATE "users" SET "leader" = true WHERE "email" = 'zhangjiejia@nexus.local'`));
const coll=readFileSync('server/collections.ts','utf8');assert(coll.includes('courseSessions: schema.courseSessions'));
console.log('Schedule (weekly / manual / occurrences / timetable / PDF), lesson + 学情反馈, 授课老师 hours and leader visibility passed.');
