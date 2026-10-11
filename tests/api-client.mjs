import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
// The API client must stay inert without NEXT_PUBLIC_API_BASE (GitHub Pages demo build).
const source=ts.transpileModule(readFileSync('lib/nexus/api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const A=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(A.API_ENABLED,false);
assert.equal(A.stableJson({b:1,a:{d:2,c:undefined}}),A.stableJson({a:{d:2},b:1}));
assert.equal(A.stableJson({id:'R1',url:'blob:x'},['url']),'{"id":"R1"}');
const synced=new Map([['S1',A.stableJson({id:'S1',health:'需关注'})],['S2',A.stableJson({id:'S2',health:'状态良好'})]]);
const list=[{health:'需关注',id:'S1'},{id:'S2',health:'状态不佳'},{id:'S3',health:'状态良好'}];
assert.deepEqual(A.changedRecords(list,synced,x=>x.id).map(x=>x.id),['S2','S3']);
console.log('API client: demo mode off by default, stable change detection and new-record sync passed.');
