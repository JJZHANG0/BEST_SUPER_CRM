// 新建课程: 课程编号 format / uniqueness and 排课冲突 (teacher / team / room).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const S=await load('lib/nexus/schedule.ts');

const courses=[
  {id:'A',name:'健康 App',program:'conrad',team:'T1',teacher:'王钰',date:'2026-10-13',time:'14:00–15:30',status:'已安排',code:'WS2026017-1-1',location:'A302'},
  {id:'B',name:'泛视',program:'conrad',team:'T2',teacher:'李老师',date:'2026-10-14',time:'09:00–10:00',status:'已安排',code:'',location:'线上直播'},
];
const sessions=[{id:'s1',course:'A',date:'2026-10-13',start:'14:00',end:'15:30'},{id:'s2',course:'A',date:'2026-10-20',start:'14:00',end:'15:30'}];

// Code format + uniqueness.
assert.equal(S.courseCodeIssue('',courses),null);
assert.equal(S.courseCodeIssue('ws2026017-1-9',courses),null,'lower-case is normalised');
assert.equal(S.courseCodeIssue('COND02501-11A',courses),null);
assert.match(S.courseCodeIssue('康莱德',courses),/格式不正确/);
assert.match(S.courseCodeIssue('WS2026017-1-1',courses),/已被其他课程使用/);
assert.equal(S.courseCodeIssue('WS2026017-1-1',courses,'A'),null,'own code is fine when editing');

// Teacher overlap.
let hits=S.scheduleConflicts([{date:'2026-10-13',start:'15:00',end:'16:00'}],{teacher:'王钰'},courses,sessions);
assert.equal(hits.length,1);assert.deepEqual(hits[0].reasons,['teacher']);assert.equal(hits[0].courseId,'A');
// Back-to-back is fine; another day is fine.
assert.equal(S.scheduleConflicts([{date:'2026-10-13',start:'15:30',end:'16:30'}],{teacher:'王钰'},courses,sessions).length,0);
assert.equal(S.scheduleConflicts([{date:'2026-10-21',start:'14:00',end:'15:00'}],{teacher:'王钰'},courses,sessions).length,0);
// Team and room, different teacher.
hits=S.scheduleConflicts([{date:'2026-10-20',start:'14:30',end:'15:00'}],{teacher:'X',team:'T1',location:' a302 '},courses,sessions);
assert.deepEqual(hits[0].reasons,['team','room']);
// Generic online rooms never conflict; course without sessions uses its date/time.
assert.equal(S.scheduleConflicts([{date:'2026-10-14',start:'09:30',end:'10:30'}],{teacher:'X',location:'线上直播'},courses,sessions).length,0);
assert.equal(S.scheduleConflicts([{date:'2026-10-14',start:'09:30',end:'10:30'}],{teacher:'李老师'},courses,sessions).length,1);
// The course itself (editing) is excluded.
assert.equal(S.scheduleConflicts([{date:'2026-10-13',start:'14:00',end:'15:00'}],{courseId:'A',teacher:'王钰'},courses,sessions).length,0);
assert.match(S.conflictSummary(S.scheduleConflicts([{date:'2026-10-13',start:'14:00',end:'15:00'}],{teacher:'王钰'},courses,sessions)),/2026-10-13 14:00–15:30 健康 App（同一老师）/);
console.log('course-conflicts: ok');
