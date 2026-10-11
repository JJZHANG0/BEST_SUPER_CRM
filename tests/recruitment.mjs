import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('lib/nexus/recruitment.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {cohortAvailability}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const team={id:'T001'};
const offer={capacity:4,admission:'招生中'};
const entry=(student,status='进行中',team='T001')=>({student,status,team});
let records=[entry('a'),entry('a'),entry('b','暂停中'),entry('c','已退出'),entry('d','已结项'),entry('e','待分配'),entry('f','进行中','T002')];
assert.deepEqual(cohortAvailability(team,records,offer),{confirmed:2,capacity:4,remaining:2,status:'招生中',progress:50});
records.push(entry('g'),entry('h'));assert.equal(cohortAvailability(team,records,offer).status,'已满员');
records.push(entry('i'));assert.equal(cohortAvailability(team,records,offer).remaining,0);assert.equal(cohortAvailability(team,records,offer).progress,100);
records=records.map(e=>({...e,status:'已退出'}));assert.equal(cohortAvailability(team,records,offer).remaining,4);
assert.equal(cohortAvailability({id:'X'},[],{capacity:6,admission:'已截止'}).status,'已截止');assert.equal(cohortAvailability({id:'Y'},[],{capacity:6,admission:'筹备中'}).status,'筹备中');
// No configured cohort: capacity follows confirmed students (no fake numbers).
assert.deepEqual(cohortAvailability({id:'T001'},[entry('a')]),{confirmed:1,capacity:1,remaining:0,status:'筹备中',progress:100});
console.log('Admissions: unique active students, reserved pause, exclusions, full/over capacity, reopened capacity, closed and upcoming cohorts passed.');
