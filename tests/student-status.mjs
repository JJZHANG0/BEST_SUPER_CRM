import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('lib/nexus/students.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {healthLevels,healthRank,sortByHealth,seedAssignments,assignmentSummary}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

assert.deepEqual([...healthLevels],['状态不佳','需关注','状态良好']);
assert(healthRank('状态不佳')<healthRank('需关注')&&healthRank('需关注')<healthRank('状态良好'));
assert.equal(healthRank('未知'),3);

const students=[{id:'a',health:'状态良好'},{id:'b',health:'需关注'},{id:'c',health:'状态不佳'},{id:'d',health:'需关注'},{id:'e',health:'状态不佳'},{id:'f'}];
const work=[{student:'e',status:'逾期未交'},{student:'e',status:'逾期未交'},{student:'c',status:'逾期未交'},{student:'d',status:'需修改'}];
// Worst first; within a level more overdue, then more rework; ties keep input order; unknown last.
assert.deepEqual(sortByHealth(students,work).map(s=>s.id),['e','c','d','b','a','f']);
assert.deepEqual(sortByHealth(students).map(s=>s.id),['c','e','b','d','a','f']);
assert.deepEqual(students.map(s=>s.id),['a','b','c','d','e','f'],'input is not mutated');

const seeded=seedAssignments([{id:'p',program:'bpa',health:'状态不佳'},{id:'g',program:'ctb',health:'状态良好'}]);
const poor=assignmentSummary(seeded.filter(a=>a.student==='p')),good=assignmentSummary(seeded.filter(a=>a.student==='g'));
assert.equal(poor.total,5);assert(poor.overdue>=2&&poor.revise>=1);assert.equal(good.overdue,0);assert.equal(good.revise,0);
assert(good.rate>poor.rate,'healthy students submit more of their due work');
assert(good.average>poor.average);
assert(seeded.every(a=>a.status!=='逾期未交'||a.submitted===null),'overdue work has no submission date');
assert.equal(assignmentSummary([]).rate,100);assert.equal(assignmentSummary([]).average,null);
console.log('Student status: level order, worst-first stable sort with homework tiebreak, seeded homework shape and summaries passed.');
