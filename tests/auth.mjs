import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=ts.transpileModule(readFileSync('lib/nexus/auth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {authenticateDemo,demoAccounts}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

assert.equal(demoAccounts.length,2);
assert.equal(authenticateDemo('sales@nexus.demo','NexusSales2026!')?.role,'sales');
assert.equal(authenticateDemo(' OPS@NEXUS.DEMO ','NexusOps2026!')?.role,'ops');
assert.equal(authenticateDemo('sales@nexus.demo','wrong'),null);
assert.equal(authenticateDemo('admin@nexus.demo','NexusDemo2026'),null);
console.log('Demo authorization: two accounts, role mapping, normalization and invalid credentials passed.');
