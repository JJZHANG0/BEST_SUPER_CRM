import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=ts.transpileModule(readFileSync('lib/nexus/todos.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const T=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(T.seedTodos,undefined,'no seeded sample todos');
const base={userId:'xujin@nexus.local',note:undefined,dueAt:null,completedAt:null,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'};
const open=[{...base,id:'a',title:'A',dueAt:'2026-10-15'},{...base,id:'b',title:'B',dueAt:'2026-10-12'},{...base,id:'c',title:'C'}];
assert.deepEqual(T.openTodos(open).map(t=>t.id),['b','a','c']);
const withDone=[...open,{...base,id:'d1',title:'D1',completedAt:'2026-10-05T10:00:00+08:00'},{...base,id:'d2',title:'D2',completedAt:'2026-09-20T10:00:00+08:00'},{...base,id:'d3',title:'D3',completedAt:'2026-10-08T10:00:00+08:00'}];
assert.equal(T.openTodos(withDone).length,3);assert.equal(T.doneTodos(withDone).length,3);
const groups=T.groupDoneByMonth(withDone,'Asia/Shanghai');
assert.deepEqual(groups.map(g=>g.label),['2026年10月','2026年9月']);assert.equal(groups[0].items.length,2);
assert.equal(T.formatDue('2026-10-15'),'10/15');
assert.deepEqual(T.storedTodos(null),[]);assert.deepEqual(T.storedTodos([{id:'X',title:'自定义'},{bad:1}]).map(t=>t.id),['X']);
assert.equal(T.isDone({completedAt:'2026-10-01T00:00:00Z'}),true);assert.equal(T.isOpen({completedAt:null}),true);

const page=readFileSync('app/page.tsx','utf8');
assert(page.includes("['todos','待办事项'"));assert(page.includes("['todos-done','已完成'"));
const dash=readFileSync('components/nexus/dashboard.tsx','utf8');
assert(dash.includes('TodoHomeCard'));
// Date line: icon + date are one flex item aligned to the note's first line.
const row=readFileSync('components/nexus/todos.tsx','utf8');
assert(row.includes('className="todo-meta"')&&row.includes('className="todo-note"'));
assert(/\.todo-meta \.todo-due\{[^}]*align-items:center[^}]*height:1\.6em/.test(readFileSync('app/globals.css','utf8')));
const schema=readFileSync('db/schema.ts','utf8');
assert(schema.includes("pgTable('todos'"));
assert(readFileSync('drizzle/0001_blue_ben_parker.sql','utf8').includes('CREATE TABLE "todos"'));
console.log('Todos: empty start, open/done sort, month grouping, storage parsing, date-line alignment and wiring passed.');
