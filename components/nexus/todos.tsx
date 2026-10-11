'use client';
import { useMemo, useState } from 'react';
import { Check, Circle, Plus, Trash2, CalendarDays, RotateCcw, ListTodo, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { useNexus } from '@/lib/nexus/store';
import { openTodos, doneTodos, groupDoneByMonth, formatDue, DEMO_TODO_USER, type Todo } from '@/lib/nexus/todos';
import { SectionTitle, PageTitle, NoResults, FormField } from './ui';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';

function mine(list: Todo[], user: { id?: number; email?: string } | null, role: string) {
  const key = user?.id != null ? user.id : (user?.email || (role === 'sales' ? 'sales@nexus.demo' : DEMO_TODO_USER));
  return list.filter(t => String(t.userId) === String(key));
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
        {!compact && <button type="button" className="text-button" onClick={() => setOpenMore(v => !v)}>{openMore ? '收起' : '更多'}</button>}
        <button type="submit" className="primary compact" disabled={busy || !title.trim()}><Plus size={16}/>添加</button>
      </div>
      {(openMore || (!compact && (note || dueAt))) && (
        <div className="todo-add-extra">
          <FormField label="截止日期（可选）"><input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} /></FormField>
          <FormField label="备注（可选）"><textarea rows={2} maxLength={500} value={note} placeholder="写给自己的周报/月报素材…" onChange={e => setNote(e.target.value)} /></FormField>
        </div>
      )}
      {compact && title.trim() && (
        <div className="todo-add-extra compact-extra">
          <input type="date" aria-label="截止日期" value={dueAt} onChange={e => setDueAt(e.target.value)} />
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
    if (mode === 'open') { s.log('完成待办：' + todo.title); toast.success('已完成，可在「已完成」中查看'); }
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
          <p>
            {todo.dueAt && <span className="todo-due"><CalendarDays size={12} />{formatDue(todo.dueAt)}</span>}
            {todo.dueAt && todo.note ? ' · ' : ''}
            {todo.note}
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
  const list = useMemo(() => openTodos(mine(s.todos, s.user, s.role)), [s.todos, s.user, s.role]);
  const preview = list.slice(0, 6);
  return (
    <section className="glass panel todo-home-panel">
      <SectionTitle title="待办事项" sub="勾选完成会从首页消失，可在「已完成」回顾" action="全部待办" onClick={() => s.go('todos')} />
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

export function TodosOpenPage() {
  const s = useNexus();
  const list = useMemo(() => openTodos(mine(s.todos, s.user, s.role)), [s.todos, s.user, s.role]);
  return (
    <>
      <PageTitle title="待办事项" en="OPEN TODOS" description="记录运营节奏，勾选完成即可归档到「已完成」。" />
      <section className="glass panel">
        <AddTodoForm />
        <div className="results-meta">{list.length} 项待办<span>按截止日期排序</span></div>
        <div className="todo-list">
          {list.map(t => <TodoRow key={t.id} todo={t} mode="open" />)}
          {!list.length && <NoResults />}
        </div>
      </section>
    </>
  );
}

export function TodosDonePage() {
  const s = useNexus();
  const groups = useMemo(() => groupDoneByMonth(mine(s.todos, s.user, s.role)), [s.todos, s.user, s.role]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <>
      <PageTitle title="已完成" en="COMPLETED" description="按月归档，方便写自己的周报与月报。" />
      <div className="results-meta">{total} 项已完成<span>按完成时间倒序 · 可恢复或删除</span></div>
      {!groups.length && <section className="glass panel"><NoResults /></section>}
      {groups.map(g => (
        <section className="glass panel todo-month" key={g.key}>
          <SectionTitle title={g.label} sub={`${g.items.length} 项`} />
          <div className="todo-list">
            {g.items.map(t => <TodoRow key={t.id} todo={t} mode="done" />)}
          </div>
        </section>
      ))}
    </>
  );
}
