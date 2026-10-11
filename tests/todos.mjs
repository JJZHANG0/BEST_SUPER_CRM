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
assert(page.includes("['todos','待办事项'"));assert(!page.includes("['todos-done'"),'已完成 is a tab, not a sidebar item');
const mod=readFileSync('components/nexus/modules.tsx','utf8');
assert(mod.includes("if(path==='todos-done')return <TodosDoneRedirect/>")&&mod.includes("if(path==='todos')return <TodosPage/>"));
const tsx=readFileSync('components/nexus/todos.tsx','utf8');
assert(tsx.includes("s.go('todos?tab=done')")&&tsx.includes('role="tablist"')&&tsx.includes('>待办<')&&tsx.includes('>已完成<'),'待办/已完成 tabs + redirect');
assert(tsx.includes('aria-label="期望DDL"')&&tsx.includes('type="date"'),'explicit 期望DDL date picker on the add form');
assert(tsx.includes('DDL {formatDue(todo.dueAt)}'),'DDL shown on each item');
const dash=readFileSync('components/nexus/dashboard.tsx','utf8');
assert(dash.includes('TodoHomeCard'));
assert(!dash.includes('需要关注的队伍')&&!dash.includes('最新项目公告'),'dashboard sections removed');
assert(dash.includes('dg-todo')&&dash.includes('dg-quick')&&dash.includes('dg-schedule'));
assert(/grid-template-areas:"todo quick" "schedule note"/.test(readFileSync('app/globals.css','utf8')),'快捷操作 beside 待办, 今日课程 below');
assert(!/14|18/.test((dash.match(/const stats = \[[\s\S]*?\];/)||[''])[0].replace(/\d+px/g,'')),'no hardcoded KPI numbers');
// Date line: icon + date are one flex item aligned to the note's first line.
const row=readFileSync('components/nexus/todos.tsx','utf8');
assert(row.includes('className="todo-meta"')&&row.includes('className="todo-note"'));
assert(/\.todo-meta \.todo-due\{[^}]*align-items:center[^}]*height:1\.6em/.test(readFileSync('app/globals.css','utf8')));
const schema=readFileSync('db/schema.ts','utf8');
assert(schema.includes("pgTable('todos'"));
assert(readFileSync('drizzle/0001_blue_ben_parker.sql','utf8').includes('CREATE TABLE "todos"'));

// 一键导出: plain-text summary per month (or all months, grouped), assigner noted.
const ex=[{...base,id:'e1',title:'完成 BPA 备课',note:'第二阶段 12 课时\n晋级奖励',dueAt:'2026-10-06',completedAt:'2026-10-05T10:00:00+08:00',assignedBy:'zhangjiejia@nexus.local',assignedByName:'张捷嘉'},{...base,id:'e2',title:'IGEM 计划书',completedAt:'2026-10-08T10:00:00+08:00'},{...base,id:'e3',title:'九月事项',completedAt:'2026-09-08T10:00:00+08:00'},{...base,id:'e4',title:'未完成'}];
const now=new Date('2026-10-11T05:51:00Z');
const oct=T.exportDoneText(ex,{month:'2026-10',name:'许瑾',now});
assert.equal(oct.split('\n')[0],'【许瑾 · 2026年10月 已完成事项】');
assert(oct.includes('共 2 项 · 导出于 2026-10-11 13:51'),'Shanghai export stamp');
assert(oct.indexOf('1. 完成 BPA 备课')<oct.indexOf('2. IGEM 计划书'),'oldest first within a month');
assert(oct.includes('完成 10月5日 · DDL 10月6日 · 由 张捷嘉 指派')&&oct.includes('   备注：第二阶段 12 课时\n         晋级奖励'));
assert(!oct.includes('九月事项')&&!oct.includes('未完成'));
const all=T.exportDoneText(ex,{month:'all',name:'许瑾',now});
assert(all.includes('全部已完成事项')&&all.includes('共 3 项')&&all.indexOf('■ 2026年10月（2 项）')<all.indexOf('■ 2026年9月（1 项）'));
assert(T.exportDoneText(ex,{month:'2026-08',now}).endsWith('（本月暂无已完成事项）'));
assert.equal(T.monthKeyOf('2026-09-30T20:00:00Z'),'2026-10','month key in Asia/Shanghai');
// 任务指派: owner vs assigner views.
const asg=[{...base,id:'a1',userId:'xujin@nexus.local',title:'核对出行',assignedBy:'zhangjiejia@nexus.local',assignedByName:'张捷嘉'},{...base,id:'a2',userId:'fangyanqi@nexus.local',title:'整理照片',assignedBy:'zhangjiejia@nexus.local',assignedByName:'张捷嘉',completedAt:'2026-10-09T10:00:00+08:00'},{...base,id:'a3',userId:'zhangjiejia@nexus.local',title:'自己的'}];
assert.deepEqual(T.ownedBy(asg,'XUJIN@nexus.local').map(t=>t.id),['a1']);
assert.deepEqual(T.assignedByKey(asg,'zhangjiejia@nexus.local').map(t=>t.id),['a1','a2']);
assert.deepEqual(T.assignedByKey(asg,'xujin@nexus.local'),[]);
assert.deepEqual(T.assignmentStats(T.assignedByKey(asg,'zhangjiejia@nexus.local')),{total:2,done:1,open:1});
assert(tsx.includes('一键导出')&&tsx.includes('一键复制')&&tsx.includes('>当月绩效<')&&tsx.includes('>我指派的<')&&tsx.includes('由 {todo.assignedByName} 指派'));
const clip=readFileSync('lib/nexus/clipboard.ts','utf8');
assert(clip.includes('window.isSecureContext')&&clip.includes("execCommand('copy')"),'clipboard API with legacy fallback');
const app=readFileSync('server/app.ts','utf8');
assert(app.includes('指派的任务只能由指派人撤回')&&app.includes('指派的任务由负责老师标记完成'),'assignee / assigner rules on the API');
console.log('Todos: export text, assignment views, empty start, open/done sort, month grouping, storage parsing, date-line alignment and wiring passed.');
