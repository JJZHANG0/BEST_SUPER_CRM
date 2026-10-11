import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=ts.transpileModule(readFileSync('lib/nexus/todos.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {seedTodos,openTodos,doneTodos,groupDoneByMonth,formatDue,mergeStoredTodos,isOpen,isDone,DEMO_TODO_USER}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

const seeded=seedTodos(DEMO_TODO_USER,new Date('2026-10-11T04:00:00+08:00'));
assert.equal(seeded.length,4);
assert(seeded.every(t=>isOpen(t)&&t.userId===DEMO_TODO_USER));
assert(seeded.every(t=>t.title.trim().length>0));
assert.equal(openTodos(seeded).length,4);
assert.equal(doneTodos(seeded).length,0);

const withDone=[
  ...seeded,
  {...seeded[0],id:'TODO-done-1',title:'已完成示例 A',completedAt:'2026-10-05T10:00:00+08:00'},
  {...seeded[0],id:'TODO-done-2',title:'已完成示例 B',completedAt:'2026-09-20T10:00:00+08:00'},
  {...seeded[0],id:'TODO-done-3',title:'已完成示例 C',completedAt:'2026-10-08T10:00:00+08:00'},
];
assert.equal(openTodos(withDone).length,4);
assert.equal(doneTodos(withDone).length,3);
const groups=groupDoneByMonth(withDone,'Asia/Shanghai');
assert.deepEqual(groups.map(g=>g.label),['2026年10月','2026年9月']);
assert.equal(groups[0].items.length,2);
assert.equal(groups[1].items.length,1);
assert.equal(formatDue('2026-10-15'),'10/15');
assert.deepEqual(mergeStoredTodos(seeded,null).map(t=>t.id),seeded.map(t=>t.id));
assert.deepEqual(mergeStoredTodos(seeded,[{id:'X',title:'自定义'}]).map(t=>t.id),['X']);
assert.equal(isDone({completedAt:'2026-10-01T00:00:00Z'}),true);
assert.equal(isOpen({completedAt:null}),true);

const page=readFileSync('app/page.tsx','utf8');
assert(page.includes("['todos','待办事项'"));
assert(page.includes("['todos-done','已完成'"));
assert(page.includes('工作台'));
const dash=readFileSync('components/nexus/dashboard.tsx','utf8');
assert(dash.includes('TodoHomeCard'));
assert(!dash.includes('项目运营进度'));
const schema=readFileSync('db/schema.ts','utf8');
assert(schema.includes("pgTable('todos'"));
assert(schema.includes('completedAt'));
const mig=readFileSync('drizzle/0001_blue_ben_parker.sql','utf8');
assert(mig.includes('CREATE TABLE "todos"'));

console.log('Todos: seed, open/done sort, month grouping, merge, nav/dashboard/schema wiring passed.');
