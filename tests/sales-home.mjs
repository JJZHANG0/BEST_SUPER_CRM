import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const S=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync('lib/nexus/sales.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const me={name:'王明玉',salesName:'顾问 王明玉'};
assert.ok(S.salesOwns('王明玉',me));assert.ok(S.salesOwns('顾问 王明玉',me));assert.ok(S.salesOwns('Sylvia 赵忠倩',{name:'赵忠倩',salesName:'顾问 赵忠倩'}));
assert.ok(!S.salesOwns('王明',me));assert.ok(!S.salesOwns('',me));assert.ok(!S.salesOwns('孙杰',me));
assert.equal(S.capacityFromClassType('2. 线上3-5人班型'),5);assert.equal(S.capacityFromClassType('线下8人班型'),8);assert.equal(S.capacityFromClassType('3. 线上6人及以上班型'),null);assert.equal(S.capacityFromClassType(''),null);
const art=v=>({blocks:[{type:'highlight',kind:'price',items:[{label:'项目参考价',value:v}]}]});
assert.deepEqual(S.priceFromArticle(art('¥12,800 / 人')),{fee:12800,pending:false,label:'¥12,800'});
assert.equal(S.priceFromArticle(art('¥12,800 / 人（演示）')).pending,true);assert.equal(S.priceFromArticle(art('待定')).fee,0);assert.equal(S.priceFromArticle(null).pending,true);assert.equal(S.priceFromArticle(art('1.98万')).fee,19800);
const rows=S.projectRecruitment([{id:'a',status:'招生中'},{id:'b',status:'招生中'},{id:'c',status:'已结束'}],[
  {id:'t1',program:'a',enrolled:3,capacity:5},{id:'t2',program:'a',enrolled:2,capacity:null},{id:'t3',program:'b',enrolled:5,capacity:5},{id:'t4',program:'c',enrolled:1,capacity:8}]);
const a=rows.find(r=>r.program==='a');assert.equal(a.enrolled,5);assert.equal(a.capacity,7);assert.equal(a.remaining,2);assert.equal(a.unknownTeams,1);assert.ok(a.recruiting);
assert.equal(rows.find(r=>r.program==='b').status,'已满员');assert.ok(!rows.find(r=>r.program==='c').recruiting);
assert.equal([...rows].sort(S.sortRecruitment)[0].program,'a');
console.log('sales-home: ok');
