import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const O=await load('lib/nexus/okr.ts');
const K=await load('lib/nexus/kpi.ts');

// extractJson tolerates fences / prose.
assert.deepEqual(O.extractJson('好的：\n```json\n{"a":1}\n```'),{a:1});
assert.deepEqual(O.extractJson('{"a":{"b":2}}'),{a:{b:2}});
assert.throws(()=>O.extractJson('没有 JSON'));

const raw=JSON.stringify({summary:'本月完成排课与赛事执行',objectives:[
  {category:'A',objective:'教务稳定',keyResults:Array.from({length:8},(_, i)=>({title:'KR'+i,description:'d'+i,progress:i===0?150:'80',todoIds:['T1','BOGUS']}))},
  {category:'项目运营',objective:'赛事落地',keyResults:[{title:'完成 BPA 报名',description:'x',progress:100,todoIds:['T2','T2']},{title:'',description:'empty title dropped'}]},
  {category:'D',objective:'ignored',keyResults:[{title:'不应出现'}]},
  {category:'C',objective:'',keyResults:[]},
]});
const d=O.parseOkr(raw,'2026-10',new Set(['T1','T2']));
assert.equal(d.month,'2026-10');assert.equal(d.summary,'本月完成排课与赛事执行');
assert.deepEqual(d.objectives.map(o=>o.category),['A','B','C'],'D ignored, names mapped');
assert.equal(d.objectives[0].keyResults.length,6,'capped at slot count');
assert.equal(d.objectives[0].keyResults[0].progress,100);assert.equal(d.objectives[0].keyResults[1].progress,80);
assert.deepEqual(d.objectives[0].keyResults[0].todoIds,['T1'],'unknown ids dropped');
assert.deepEqual(d.objectives[1].keyResults.map(k=>k.title),['完成 BPA 报名']);
assert.deepEqual(d.objectives[1].keyResults[0].todoIds,['T2']);
assert.throws(()=>O.parseOkr('{"objectives":[]}','2026-10'),/KR/);
assert.throws(()=>O.parseOkr('{"foo":1}','2026-10'),/objectives/);
assert.throws(()=>O.parseOkr('not json','2026-10'));

// Mapper: A–C slots filled in order, D + scores untouched, linked todo titles appended.
const base=K.blankItems().map(x=>x.id==='A1'?{...x,title:'old',score:3}:x.id==='B6'?{...x,title:'stale'}:x);
const items=O.okrToKpiItems(d,base,new Map([['T1','排课表'],['T2','BPA 报名表']]));
assert.equal(items.length,20);
const by=id=>items.find(x=>x.id===id);
assert.equal(by('A1').title,'KR0');assert.equal(by('A1').score,3,'score kept');
assert.equal(by('A1').description,'d0\n关联待办：排课表');
assert.equal(by('B1').title,'完成 BPA 报名');assert.match(by('B1').description,/BPA 报名表/);
assert.equal(by('B6').title,'','unused slots in a generated category are cleared');
assert.deepEqual(items.filter(x=>x.category==='D'),base.filter(x=>x.category==='D'));
assert.equal(K.submitIssues(K.normalizeItems(items)).length,2,'B and C still have empty KRs');
assert.equal(O.hasOkrContent(K.blankItems()),false);assert.equal(O.hasOkrContent(base),true);

// Prompt: size caps and content.
const many=Array.from({length:400},(_, i)=>({id:'T'+i,title:'事项'+'很长'.repeat(150),note:'n',completedAt:'2026-10-02T00:00:00Z'}));
const tl=O.todoLines(many);
assert(tl.lines.length<=O.OKR_MAX_INPUT_CHARS);assert(tl.used<=O.OKR_MAX_TODOS);assert.equal(tl.truncated,true);
const msgs=O.buildOkrMessages({month:'2026-10',name:'徐瑾',todos:[{id:'T1',title:'排课',note:'周末',completedAt:'2026-10-02T00:00:00Z'}]});
assert.equal(msgs.length,2);assert.match(msgs[0].content,/JSON/);assert.match(msgs[1].content,/\[T1\] 排课（备注：周末）/);

// Rate limiter.
const rl=O.rateLimiter(20000);
assert.equal(rl('u1',1000),0);assert.equal(rl('u1',5000),16);assert.equal(rl('u2',5000),0);assert.equal(rl('u1',21000),0);
console.log('okr tests passed');
