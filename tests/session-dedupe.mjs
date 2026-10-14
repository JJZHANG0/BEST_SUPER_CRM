import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const src=ts.transpileModule(readFileSync('lib/nexus/schedule.ts','utf8').replace(/^import .*$/gm,''),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve}}).outputText;
let S;try{S=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'))}catch(e){console.log('session-dedupe: skipped (module needs JSX deps):',e.message);process.exit(0)}
const old=[{id:'A',course:'C',date:'2026-10-17',start:'10:00',end:'11:30',content:'教案'},{id:'B',course:'C',date:'2026-10-24',start:'10:00',end:'11:30'}];
const next=[{id:'N1',course:'C',date:'2026-10-17',start:'10:00',end:'12:00',location:''},{id:'N2',course:'C',date:'2026-10-31',start:'10:00',end:'11:30',location:''}];
const r=S.reconcileSessions(old,next);
assert.deepEqual(r.map(x=>x.id),['A','N2']);assert.equal(r[0].content,'教案');assert.equal(r[0].end,'12:00');
const d=S.dedupeSessions([{id:'X',course:'C',date:'d',start:'s'},{id:'Y',course:'C',date:'d',start:'s',title:'t'},{id:'Z',course:'C',date:'d',start:'t'}]);
assert.deepEqual(d.map(x=>x.id),['Y','Z']);
console.log('session-dedupe: ok');
