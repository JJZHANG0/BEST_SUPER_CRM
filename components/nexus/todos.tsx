'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, Circle, Plus, Trash2, CalendarDays, RotateCcw, ListTodo, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { useNexus } from '@/lib/nexus/store';
import { openTodos, groupDoneByMonth, formatDue, type Todo } from '@/lib/nexus/todos';
import { SectionTitle, PageTitle, FormField, EmptyState } from './ui';
import { today as todayIso } from '@/lib/nexus/ops';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';

/** API todos carry the numeric user id; Pages-demo todos carry the login email. */
function mine(list: Todo[], user: { id?: number; email?: string } | null, apiMode: boolean) {
  if (!user) return [];
  const key = apiMode ? String(user.id) : String(user.email || '').toLowerCase();
  return list.filter(t => String(t.userId).toLowerCase() === key);
}

function AddTodoForm({ compact, onAdded }: { compact?: boolean; onAdded?: () => void }) {
  const s = useNexus();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [openMore, setOpenMore] = useState(false);
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = title.trim();
    if (!t) { toast.error('请填写待办标题'); return; }
    setBusy(true);
    const ok = await s.addTodo({ title: t, note: note.trim() || undefined, dueAt: dueAt || null });
    setBusy(false);
    if (!ok) return;
    setTitle(''); setNote(''); setDueAt(''); setOpenMore(false);
    s.log('新增待办：' + t);
    toast.success('待办已添加');
    onAdded?.();
  };
  return (
    <form className={'todo-add' + (compact ? ' compact' : '')} onSubmit={submit}>
      <div className="todo-add-row">
        <input aria-label="新待办标题" placeholder="添加待办…" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} disabled={busy} />
        <label className="todo-ddl" title="期望完成日期（可选）"><span>期望DDL</span><input type="date" aria-label="期望DDL" value={dueAt} onChange={e => setDueAt(e.target.value)} disabled={busy} /></label>
        {!compact && <button type="button" className="text-button" onClick={() => setOpenMore(v => !v)}>{openMore ? '收起' : '备注'}</button>}
        <button type="submit" className="primary compact" disabled={busy || !title.trim()}><Plus size={16}/>添加</button>
      </div>
      {!compact && (openMore || note) && (
        <div className="todo-add-extra single">
          <FormField label="备注（可选）"><textarea rows={2} maxLength={500} value={note} placeholder="写给自己的周报/月报素材…" onChange={e => setNote(e.target.value)} /></FormField>
        </div>
      )}
      {compact && title.trim() && (
        <div className="todo-add-extra compact-extra single">
          <input aria-label="备注" placeholder="备注（可选）" maxLength={200} value={note} onChange={e => setNote(e.target.value)} />
        </div>
      )}
    </form>
  );
}

function TodoRow({ todo, mode }: { todo: Todo; mode: 'open' | 'done' }) {
  const s = useNexus();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    const ok = mode === 'open' ? await s.completeTodo(todo.id) : await s.restoreTodo(todo.id);
    setBusy(false);
    if (!ok) return;
    if (mode === 'open') { s.log('完成待办：' + todo.title); toast.success('已完成，可在待办事项的「已完成」中查看'); }
    else { s.log('恢复待办：' + todo.title); toast.success('已恢复到待办事项'); }
  };
  const remove = async () => {
    setBusy(true);
    const ok = await s.deleteTodo(todo.id);
    setBusy(false);
    if (!ok) return;
    s.log('删除待办：' + todo.title);
    toast.success('待办已删除');
  };
  return (
    <div className={'todo-row ' + mode}>
      <button type="button" className="todo-check" aria-label={mode === 'open' ? '标记完成' : '恢复为待办'} disabled={busy} onClick={toggle}>
        {mode === 'open' ? <Circle size={18} /> : <Check size={18} />}
      </button>
      <div className="todo-main">
        <strong>{todo.title}</strong>
        {(todo.note || todo.dueAt) && (
          <p className="todo-meta">
            {todo.dueAt && <span className={'todo-due' + (mode === 'open' && todo.dueAt.slice(0, 10) < todayIso() ? ' overdue' : '')} title="期望DDL"><CalendarDays size={12} aria-hidden="true" /><span>DDL {formatDue(todo.dueAt)}</span></span>}
            {todo.dueAt && todo.note && <span className="todo-sep" aria-hidden="true">·</span>}
            {todo.note && <span className="todo-note">{todo.note}</span>}
          </p>
        )}
      </div>
      <div className="todo-actions">
        {mode === 'done' && (
          <button type="button" className="icon-button" aria-label="恢复" disabled={busy} onClick={toggle}><RotateCcw size={15} /></button>
        )}
        <button type="button" className="icon-button" aria-label="删除" disabled={busy} onClick={remove}><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

/** Compact homepage card: open todos + add input. Checked items leave this list. */
export function TodoHomeCard() {
  const s = useNexus();
  const list = useMemo(() => openTodos(mine(s.todos, s.user, s.apiMode)), [s.todos, s.user, s.apiMode]);
  const preview = list.slice(0, 6);
  return (
    <section className="glass panel todo-home-panel">
      <SectionTitle title="待办事项" sub="勾选完成会从首页消失，可在待办事项 ·「已完成」回顾" action="全部待办" onClick={() => s.go('todos')} />
      <AddTodoForm compact />
      <div className="todo-list compact">
        {preview.map(t => <TodoRow key={t.id} todo={t} mode="open" />)}
        {!preview.length && (
          <Empty className="todo-empty">
            <EmptyHeader>
              <Inbox size={28} />
              <EmptyTitle>暂无待办</EmptyTitle>
              <EmptyDescription>添加一项，开始今天的运营节奏。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
      {list.length > preview.length && (
        <button className="full-link" onClick={() => s.go('todos')}>还有 {list.length - preview.length} 项待办 <ListTodo size={15} /></button>
      )}
    </section>
  );
}

type TodoTab = 'open' | 'done';
const tabOf = (route: string): TodoTab => new URLSearchParams(route.split('?')[1] || '').get('tab') === 'done' ? 'done' : 'open';

/** 待办事项 with 「待办」/「已完成」 tabs (#/todos, #/todos?tab=done). */
export function TodosPage() {
  const s = useNexus();
  const tab = tabOf(s.route);
  const own = useMemo(() => mine(s.todos, s.user, s.apiMode), [s.todos, s.user, s.apiMode]);
  const open = useMemo(() => openTodos(own), [own]);
  const groups = useMemo(() => groupDoneByMonth(own), [own]);
  const done = groups.reduce((n, g) => n + g.items.length, 0);
  const setTab = (t: TodoTab) => s.go(t === 'done' ? 'todos?tab=done' : 'todos');
  return (
    <>
      <PageTitle title="待办事项" en="TODOS" description="记录运营节奏；勾选完成即归档到「已完成」，按月回顾写周报与月报。" />
      <div className="admin-tabs todo-tabs" role="tablist" aria-label="待办分类">
        <button role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'selected' : ''} onClick={() => setTab('open')}><ListTodo size={16} />待办<em>{open.length}</em></button>
        <button role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'selected' : ''} onClick={() => setTab('done')}><Check size={16} />已完成<em>{done}</em></button>
      </div>
      {tab === 'open' ? (
        <section className="glass panel" role="tabpanel" aria-label="待办">
          <AddTodoForm />
          <div className="results-meta">{open.length} 项待办<span>按期望DDL排序</span></div>
          <div className="todo-list">
            {open.map(t => <TodoRow key={t.id} todo={t} mode="open" />)}
            {!open.length && <EmptyState icon={Inbox} title="暂无待办" description="在上方输入标题、选择期望DDL，添加第一项待办。" />}
          </div>
        </section>
      ) : (
        <div role="tabpanel" aria-label="已完成">
          <div className="results-meta">{done} 项已完成<span>按完成时间倒序 · 可恢复或删除</span></div>
          {!groups.length && <section className="glass panel"><EmptyState icon={Check} title="还没有已完成的待办" description="在「待办」中勾选完成的事项会按月归档到这里。" /></section>}
          {groups.map(g => (
            <section className="glass panel todo-month" key={g.key}>
              <SectionTitle title={g.label} sub={`${g.items.length} 项`} />
              <div className="todo-list">
                {g.items.map(t => <TodoRow key={t.id} todo={t} mode="done" />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/** Old #/todos-done links land on the 「已完成」 tab. */
export function TodosDoneRedirect() {
  const s = useNexus();
  useEffect(() => { s.go('todos?tab=done'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
