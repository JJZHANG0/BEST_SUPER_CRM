// 课程编号 validation + 排课冲突 (teacher / team / room) shared by the form and the API.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const S=await load('lib/nexus/schedule.ts');
const courses=[
  {id:'A',name:'商业计划',program:'bpa',team:'T1',teacher:'王钰',date:'2026-10-13',time:'14:00–15:30',status:'已安排',code:'WS2026017-1-1',location:'A302 教室'},
  {id:'B',name:'路演',program:'bpa',team:'T2',teacher:'李老师',date:'2026-10-14',time:'09:00–10:00',status:'已安排',location:'线上直播'},
];
const sessions=[{id:'s1',course:'A',date:'2026-10-13',start:'14:00',end:'15:30'},{id:'s2',course:'A',date:'2026-10-20',start:'14:00',end:'15:30'}];
// Code format + uniqueness.
assert.equal(S.courseCodeIssue('',courses),null);
assert.match(S.courseCodeIssue('康莱德',courses),/格式不正确/);
assert.equal(S.courseCodeIssue('ws2026017-1-9',courses),null,'case-insensitive, normalised');
assert.equal(S.courseCodeIssue('COND02501-11A',courses),null);
assert.match(S.courseCodeIssue('ws2026017-1-1',courses),/已被其他课程使用/);
assert.equal(S.courseCodeIssue('WS2026017-1-1',courses,'A'),null,'own code is fine');
assert.equal(S.normalizeCourseCode(' ws2026017-1-2 '),'WS2026017-1-2');
// Known library codes (ops_courses).
const known=[{code:'WS2026017-1-1'},{code:'COND02501-11A'}];
assert.equal(S.knownCourseCodeIssue('',known),null);
assert.equal(S.knownCourseCodeIssue('ws2026017-1-1',known),null);
assert.match(S.knownCourseCodeIssue('WS9999999-9-9',known),/编号不存在/);
// Conflicts.
const slot=(date,start,end)=>({date,start,end});
const t=S.scheduleConflicts([slot('2026-10-20','15:00','16:00')],{teacher:'王钰'},courses,sessions);
assert.equal(t.length,1);assert.deepEqual(t[0].reasons,['teacher']);assert.equal(t[0].date,'2026-10-20');
assert.equal(S.scheduleConflicts([slot('2026-10-20','15:30','16:30')],{teacher:'王钰'},courses,sessions).length,0,'back-to-back is fine');
assert.deepEqual(S.scheduleConflicts([slot('2026-10-13','15:00','16:00')],{teacher:'X',team:'T1'},courses,sessions)[0].reasons,['team']);
assert.deepEqual(S.scheduleConflicts([slot('2026-10-13','15:00','16:00')],{teacher:'X',location:'a302教室'},courses,sessions)[0].reasons,['room']);
assert.equal(S.scheduleConflicts([slot('2026-10-14','09:30','10:30')],{teacher:'X',location:'线上直播'},courses,sessions).length,0,'online never clashes by room');
assert.equal(S.scheduleConflicts([slot('2026-10-14','09:30','10:30')],{teacher:'李老师'},courses,sessions).length,1,'course without sessions uses date/time');
assert.equal(S.scheduleConflicts([slot('2026-10-13','14:00','15:00')],{courseId:'A',teacher:'王钰'},courses,sessions).length,0,'own sessions ignored');
assert.match(S.conflictSummary(t),/2026-10-20 14:00–15:30 商业计划（同一老师）/);
console.log('course-guard ok');
