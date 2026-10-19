// One silent retry for retry-safe requests when fetch() rejects (no HTTP response); none for plain POST or 4xx.
import assert from 'node:assert/strict';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
let calls = 0, mode = 'drop-once';
globalThis.fetch = async () => { calls++; if (mode === 'drop-once' && calls === 1) throw new TypeError('Load failed'); if (mode === 'down') throw new TypeError('Load failed'); return new Response(JSON.stringify(mode === '401' ? { error: 'unauthorized' } : { ok: true }), { status: mode === '401' ? 401 : 200 }); };
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const src = ts.transpileModule(readFileSync('lib/nexus/api.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { api, NetworkError, ApiError } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
calls = 0; mode = 'drop-once'; await api.login('a', 'b'); assert.equal(calls, 2);
calls = 0; mode = 'drop-once'; await api.put('lessons', 'L1', { id: 'L1' }); assert.equal(calls, 2);
calls = 0; mode = 'drop-once'; await assert.rejects(api.createTodo({ title: 'x' }), e => e instanceof NetworkError); assert.equal(calls, 1);
calls = 0; mode = '401'; await assert.rejects(api.login('a', 'b'), e => e instanceof ApiError && e.status === 401); assert.equal(calls, 1);
calls = 0; mode = 'down'; await assert.rejects(api.put('lessons', 'L1', { id: 'L1' }), e => e instanceof NetworkError); assert.equal(calls, 2);
console.log('api-retry: ok');
