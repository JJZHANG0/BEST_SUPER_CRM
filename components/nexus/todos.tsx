'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Circle, Plus, Trash2, CalendarDays, RotateCcw, ListTodo, Inbox, Share2, Copy, Target, Send, UserRoundCheck, Undo2, Crown, Sparkles } from 'lucide-react';
import { HuskyLabel } from './brand';
import { toast } from 'sonner';
import { useNexus } from '@/lib/nexus/store';
import { openTodos, groupDoneByMonth, formatDue, ownedBy, assignedByKey, assignedToKey, assignmentStats, exportDoneText, monthKeyLabel, isDone, CAPITALIST_TAG, UPWARD_TAG, type Todo } from '@/lib/nexus/todos';
import { SectionTitle, PageTitle, FormField, EmptyState, Picker } from './ui';
import { today as todayIso, currentMonth } from '@/lib/nexus/ops';
import { canAssignTodos, canAssignToLeader, canFillKpi } from '@/lib/nexus/roles';
import { copyText } from '@/lib/nexus/clipboard';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { KpiSelfPanel } from './kpi';
import { GenerateOkrButton } from './okr';

/** Todos owned by the signed-in user (API: numeric user id; Pages demo: login email). */
function mine(list: Todo[], meKey: string) {
  return meKey ? ownedBy(list, meKey) : [];
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
  const assignedToMe = !!todo.assignedByName && String(todo.assignedBy ?? '').toLowerCase() !== s.meKey.toLowerCase();
  const upward = assignedToMe && s.leader;
  const tag = upward ? UPWARD_TAG : CAPITALIST_TAG;
  const verb = upward ? '布置' : '指派';
  return (
    <div className={'todo-row ' + mode + (assignedToMe ? ' assigned' : '')}>
      <button type="button" className="todo-check" aria-label={mode === 'open' ? '标记完成' : '恢复为待办'} disabled={busy} onClick={toggle}>
        {mode === 'open' ? <Circle size={18} /> : <Check size={18} />}
      </button>
      <div className="todo-main">
        <strong>{todo.title}{assignedToMe && <span className={upward ? 'todo-upward-tag' : 'todo-capitalist-tag'} title={`由 ${todo.assignedByName} ${verb} · ${formatDue(todo.createdAt)}`} aria-label={`${tag}（由 ${todo.assignedByName} ${verb}）`}>{tag}</span>}</strong>
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
        {!assignedToMe && <button type="button" className="icon-button" aria-label="删除" disabled={busy} onClick={remove}><Trash2 size={15} /></button>}
      </div>
    </div>
  );
}

/** 「一键导出」: plain-text summary of completed todos for 周报 / 月报, with 「一键复制」. */
export function ExportDoneDialog({ open, onClose, todos, initialMonth }: { open: boolean; onClose: () => void; todos: Todo[]; initialMonth: string }) {
  const s = useNexus();
  const groups = useMemo(() => groupDoneByMonth(todos), [todos]);
  const cur = currentMonth();
  const months = useMemo(() => [...new Set([cur, initialMonth, ...groups.map(g => g.key)])].filter(m => m !== 'all').sort((a, b) => b.localeCompare(a)), [groups, cur, initialMonth]);
  const [month, setMonth] = useState(initialMonth);
  const text = useMemo(() => exportDoneText(todos, { month, name: s.user?.name || '' }), [todos, month, s.user?.name]);
  const count = month === 'all' ? groups.reduce((n, g) => n + g.items.length, 0) : groups.find(g => g.key === month)?.items.length || 0;
  const box = useRef<HTMLDivElement>(null), pre = useRef<HTMLPreElement>(null);
  const copy = async () => {
    if (await copyText(text, box.current)) { toast.success('已复制到剪贴板，可直接粘贴到周报 / 月报'); return; }
    // Last resort: select the text so the user can press ⌘C / Ctrl+C.
    const sel = window.getSelection(); const range = document.createRange();
    if (pre.current && sel) { range.selectNodeContents(pre.current); sel.removeAllRanges(); sel.addRange(range); }
    toast.error('浏览器不允许自动复制，已为你选中文本，请按 ⌘C / Ctrl+C 复制');
  };
  return <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog wide export-dialog">
    <div ref={box} className="export-body">
      <DialogTitle>一键导出已完成事项</DialogTitle>
      <DialogDescription>按月整理成纯文本，复制后可直接粘贴到周报、月报或绩效自评。</DialogDescription>
      <div className="export-toolbar">
        <Picker label="导出月份" value={month} onChange={setMonth} options={[...months.map(m => ({ value: m, label: monthKeyLabel(m) + (m === cur ? '（本月）' : '') })), { value: 'all', label: '全部月份（按月分组）' }]} />
        <span className="export-count">{count} 项已完成</span>
      </div>
      <pre ref={pre} className="export-preview" tabIndex={0} aria-label="导出内容预览">{text}</pre>
      <div className="actions">
        <button type="button" className="secondary" onClick={onClose}>关闭</button>
        <button type="button" className="primary" onClick={copy}><Copy size={16} />一键复制</button>
      </div>
    </div>
  </DialogContent></Dialog>;
}

/** 指派任务 (superadmin): create a todo in an ops teacher's list. */
function AssignDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useNexus();
  const me = String(s.user?.email || '').toLowerCase();
  const people = s.staff.filter(u => u.active && !u.leader && u.email.toLowerCase() !== me).sort((a, b) => (a.role === 'ops' ? 0 : 1) - (b.role === 'ops' ? 0 : 1));
  const [assignee, setAssignee] = useState(people[0]?.email || '');
  const [title, setTitle] = useState(''), [note, setNote] = useState(''), [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignee) { toast.error('请选择负责老师'); return; }
    if (!title.trim()) { toast.error('请填写任务标题'); return; }
    setBusy(true);
    const ok = await s.addTodo({ title: title.trim(), note: note.trim() || undefined, dueAt: dueAt || null, assignee });
    setBusy(false);
    if (!ok) return;
    const name = s.staffName(assignee);
    s.log(`指派任务给 ${name}：${title.trim()}`);
    toast.success(`已指派给 ${name}，将出现在 TA 的待办中`);
    onClose();
  };
  return <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog">
    <DialogTitle>指派任务</DialogTitle>
    <DialogDescription>任务会直接出现在负责老师的待办列表中，并带上 {CAPITALIST_TAG} 标签（悬停可见指派人 {s.user?.name || '我'}）；完成后你可以在「我指派的」中看到。</DialogDescription>
    {!people.length ? <EmptyState icon={UserRoundCheck} title="还没有可指派的运营老师" description="先在系统管理中添加运营老师账号。" /> : <form className="form-stack" onSubmit={submit}>
      <FormField label="负责老师"><Picker label="负责老师" value={assignee} onChange={setAssignee} options={people.map(u => ({ value: u.email, label: u.name + (u.role === 'ops' ? '' : '（超级管理员）') }))} /></FormField>
      <FormField label="任务标题"><input autoFocus required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：完成 BPA 香港站参赛学生出行信息核对" /></FormField>
      <div className="form-columns">
        <FormField label="期望DDL（可选）"><input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} /></FormField>
        <div />
      </div>
      <FormField label="说明（可选）"><textarea rows={3} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="交付标准、相关学生或文件…" /></FormField>
      <div className="actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" type="submit" disabled={busy || !title.trim()}><Send size={16} />指派</button></div>
    </form>}
  </DialogContent></Dialog>;
}

const ALL = '__all';
/** 「我指派的」: tasks this superadmin assigned, with each assignee's completion status. */
function AssignedPanel() {
  const s = useNexus();
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState(ALL), [state, setState] = useState(ALL);
  const list = useMemo(() => assignedByKey(s.todos, s.meKey), [s.todos, s.meKey]);
  const ownerKey = (t: Todo) => String(t.ownerEmail || t.userId).toLowerCase();
  const ownerName = (t: Todo) => t.ownerName || s.staffName(String(t.ownerEmail || t.userId));
  const people = [...new Map(list.map(t => [ownerKey(t), ownerName(t)])).entries()];
  const rows = list.filter(t => (who === ALL || ownerKey(t) === who) && (state === ALL || (state === 'done' ? isDone(t) : !isDone(t))))
    .sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || (a.dueAt || '9999').localeCompare(b.dueAt || '9999') || b.createdAt.localeCompare(a.createdAt));
  const stats = assignmentStats(list);
  const withdraw = async (t: Todo) => {
    if (!window.confirm(`撤回指派给 ${ownerName(t)} 的任务「${t.title}」？`)) return;
    if (await s.deleteTodo(t.id)) { s.log('撤回指派：' + t.title); toast.success('已撤回'); }
  };
  return <section className="glass panel" role="tabpanel" aria-label="我指派的">
    <div className="assign-head">
      <div className="assign-stats">
        <div><span>已指派</span><b>{stats.total}</b></div>
        <div><span>进行中</span><b>{stats.open}</b></div>
        <div className="good"><span>已完成</span><b>{stats.done}</b></div>
      </div>
      <button type="button" className="primary compact" onClick={() => setOpen(true)}><Send size={15} />指派任务</button>
    </div>
    {list.length > 0 && <div className="filter-toolbar assign-filters">
      <Picker label="负责老师" value={who} onChange={setWho} options={[{ value: ALL, label: '全部老师' }, ...people.map(([k, n]) => ({ value: k, label: n }))]} />
      <Picker label="完成状态" value={state} onChange={setState} options={[{ value: ALL, label: '全部状态' }, { value: 'open', label: '进行中' }, { value: 'done', label: '已完成' }]} />
    </div>}
    <div className="results-meta">{rows.length} 项指派<span>未完成的排在前面 · 按期望DDL排序</span></div>
    <div className="todo-list">
      {rows.map(t => {
        const done = isDone(t), overdue = !done && !!t.dueAt && t.dueAt.slice(0, 10) < todayIso();
        return <div key={t.id} className={'todo-row assign-row ' + (done ? 'done' : 'open')}>
          <div className="assign-who">
            <span className="avatar small-avatar" aria-hidden="true">{ownerName(t).slice(0, 1)}</span>
            <span className="assign-owner">{ownerName(t)}</span>
          </div>
          <div className="todo-main">
            <strong>{t.title}</strong>
            {(t.dueAt || t.note) && (
              <p className="todo-meta">
                {t.dueAt && <span className={'todo-due' + (overdue ? ' overdue' : '')}><CalendarDays size={12} aria-hidden="true" /><span>DDL {formatDue(t.dueAt)}</span></span>}
                {t.dueAt && t.note && <span className="todo-sep" aria-hidden="true">·</span>}
                {t.note && <span className="todo-note">{t.note}</span>}
              </p>
            )}
          </div>
          <span className={'assign-state ' + (done ? 'good' : overdue ? 'poor' : 'watch')}>{done ? `已完成 · ${formatDue(t.completedAt)}` : overdue ? '已逾期' : '进行中'}</span>
          <div className="todo-actions"><button type="button" className="icon-button" aria-label="撤回指派" title="撤回指派" onClick={() => withdraw(t)}><Undo2 size={15} /></button></div>
        </div>;
      })}
      {!rows.length && (list.length
        ? <EmptyState icon={Inbox} title="没有符合条件的任务" description="换个老师或状态看看。" />
        : <EmptyState icon={Send} title="还没有指派任务" description="把任务指派给运营老师，它会出现在 TA 的待办中，完成后在这里查看进度。" action="指派任务" onAction={() => setOpen(true)} />)}
    </div>
    {open && <AssignDialog open={open} onClose={() => setOpen(false)} />}
  </section>;
}

/** 以下犯上: an ops teacher assigns one task to the 部门负责人 (张捷嘉), nobody else. */
function BossDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useNexus();
  const boss = s.staff.find(u => u.active && u.leader);
  const [title, setTitle] = useState(''), [note, setNote] = useState(''), [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boss) { toast.error('还没有找到张捷嘉老师的账号'); return; }
    if (!title.trim()) { toast.error('请填写要布置的工作'); return; }
    setBusy(true);
    const ok = await s.addTodo({ title: title.trim(), note: note.trim() || undefined, dueAt: dueAt || null, assignee: boss.email });
    setBusy(false);
    if (!ok) return;
    s.log(`给${boss.name}老师布置工作：${title.trim()}`);
    toast.success(`已布置给${boss.name}老师。做不做，看领导心情。`);
    onClose();
  };
  return <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog">
    <DialogTitle>给{boss?.name || '张捷嘉'}老师布置工作</DialogTitle>
    <DialogDescription>仅此一位领导可以接收。任务会出现在 TA 的待办里，并盖上 {UPWARD_TAG}。做不做，看领导心情。</DialogDescription>
    {!boss ? <EmptyState icon={Crown} title="还没有找到领导账号" description="张捷嘉老师的账号需要是在职的部门负责人。" /> : <form className="form-stack" onSubmit={submit}>
      <div className="course-locked" aria-label="布置对象"><strong>{boss.name}老师</strong><small>部门负责人 · 唯一可布置对象</small></div>
      <FormField label="工作内容"><input autoFocus required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：请领导亲自核对这周的家长群反馈" /></FormField>
      <FormField label="期望DDL（可选，领导未必认）"><input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} /></FormField>
      <FormField label="补充说明（可选）"><textarea rows={3} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="越具体，领导越难装没看见" /></FormField>
      <div className="actions"><button type="button" className="secondary" onClick={onClose}>算了，不敢</button><button className="primary" type="submit" disabled={busy || !title.trim()}><Sparkles size={16} />大胆布置</button></div>
    </form>}
  </DialogContent></Dialog>;
}

/** 「以下犯上」: ops see what they assigned to the leader; the leader sees what staff assigned to them. */
function UpwardPanel() {
  const s = useNexus();
  const bossing = canAssignToLeader(s.viewer);
  const [open, setOpen] = useState(false);
  const list = useMemo(() => bossing ? assignedByKey(s.todos, s.meKey) : assignedToKey(s.todos, s.meKey), [bossing, s.todos, s.meKey]);
  const boss = s.staff.find(u => u.leader);
  const rows = [...list].sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || (a.dueAt || '9999').localeCompare(b.dueAt || '9999') || b.createdAt.localeCompare(a.createdAt));
  const stats = assignmentStats(list);
  const withdraw = async (t: Todo) => {
    if (!window.confirm(`撤回布置给${boss?.name || '领导'}老师的工作「${t.title}」？`)) return;
    if (await s.deleteTodo(t.id)) { s.log('撤回给领导的工作：' + t.title); toast.success('已撤回，领导可以装没这回事了'); }
  };
  if (!bossing) return <section className="glass panel" role="tabpanel" aria-label="以下犯上">
    <p className="leader-tab-intro">员工鼓起勇气布置给你的工作。做完就勾掉，<b>假装没看见也行</b>。</p>
    <div className="results-meta">{stats.open} 项还没做 · {stats.done} 项已笑纳<span>未完成的排在前面</span></div>
    <div className="todo-list">
      {rows.filter(t => !isDone(t)).map(t => <TodoRow key={t.id} todo={t} mode="open" />)}
      {rows.filter(isDone).map(t => <TodoRow key={t.id} todo={t} mode="done" />)}
      {!list.length && <EmptyState icon={Sparkles} title="还没有员工敢给你派活" description="运营老师在「以下犯上」里布置的工作会出现在这里，也会进你的待办。" />}
    </div>
  </section>;
  return <section className="glass panel" role="tabpanel" aria-label="以下犯上">
    <div className="assign-head">
      <div className="assign-stats">
        <div><span>已布置</span><b>{stats.total}</b></div>
        <div><span>领导还没做</span><b>{stats.open}</b></div>
        <div><span>已笑纳</span><b>{stats.done}</b></div>
      </div>
      <button type="button" className="primary compact" onClick={() => setOpen(true)}><Sparkles size={15} />给{boss?.name || '张捷嘉'}老师布置</button>
    </div>
    <p className="leader-tab-intro">只能布置给<b>{boss?.name || '张捷嘉'}老师</b>。TA 的待办会盖上 {UPWARD_TAG}，做不做，看领导心情。</p>
    <div className="todo-list">
      {rows.map(t => {
        const done = isDone(t);
        return <div key={t.id} className={'todo-row ' + (done ? 'done' : 'open') + ' assigned'}>
          <span className="todo-check static" aria-hidden="true">{done ? <Check size={18} /> : <Circle size={18} />}</span>
          <div className="todo-main">
            <strong>{t.title}<span className="todo-upward-tag">{UPWARD_TAG}</span></strong>
            <p className="todo-meta">
              <span>{done ? '领导已完成' : '等领导笑纳'}</span>
              {t.dueAt && <><span className="todo-sep" aria-hidden="true">·</span><span className="todo-due"><CalendarDays size={12} />DDL {formatDue(t.dueAt)}</span></>}
              {t.note && <><span className="todo-sep" aria-hidden="true">·</span><span className="todo-note">{t.note}</span></>}
            </p>
          </div>
          <div className="todo-actions"><button type="button" className="icon-button" aria-label="撤回布置" title="撤回布置" onClick={() => withdraw(t)}><Undo2 size={15} /></button></div>
        </div>;
      })}
      {!rows.length && <EmptyState icon={Sparkles} title="还没敢给领导派活" description="写一项正经的（或不正经的）工作。它会出现在张捷嘉老师的待办里。" action="给领导布置工作" onAction={() => setOpen(true)} />}
    </div>
    {open && <BossDialog open={open} onClose={() => setOpen(false)} />}
  </section>;
}

/** 「领导万岁」: tasks the 部门负责人 assigned to me (they also sit in my normal todo list with the tag). */
function LeaderPanel({ list }: { list: Todo[] }) {
  const open = openTodos(list), done = list.filter(isDone).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  return <section className="glass panel" role="tabpanel" aria-label="领导万岁">
    <div className="results-meta">{open.length} 项进行中 · {done.length} 项已完成<span>按期望DDL排序</span></div>
    <div className="todo-list">
      {open.map(t => <TodoRow key={t.id} todo={t} mode="open" />)}
      {done.map(t => <TodoRow key={t.id} todo={t} mode="done" />)}
      {!list.length && <EmptyState icon={UserRoundCheck} title="领导暂时没有给你派活" description="部门负责人指派的任务会直接出现在你的待办里，也会汇总在这里。" />}
    </div>
  </section>;
}

/** Compact homepage card: open todos + add input. Checked items leave this list. */
export function TodoHomeCard() {
  const s = useNexus();
  const list = useMemo(() => openTodos(mine(s.todos, s.meKey)), [s.todos, s.meKey]);
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

type TodoTab = 'open' | 'done' | 'kpi' | 'assigned' | 'leader' | 'upward';
const tabOf = (route: string): TodoTab => { const t = new URLSearchParams(route.split('?')[1] || '').get('tab'); return t === 'done' || t === 'kpi' || t === 'assigned' || t === 'leader' || t === 'upward' ? t : 'open'; };

/** 待办事项 with 「待办」/「已完成」/「当月绩效」(+「我指派的」 for superadmins) tabs (#/todos?tab=…). */
export function TodosPage() {
  const s = useNexus();
  const assigner = canAssignTodos(s.viewer), fillsKpi = canFillKpi(s.viewer), bossing = canAssignToLeader(s.viewer);
  const routeTab = tabOf(s.route);
  // 部门负责人: 「我指派的」+ incoming 「以下犯上」. Ops: 「领导万岁」+ outgoing 「以下犯上」.
  const tab: TodoTab = (routeTab === 'assigned' && !assigner) || (routeTab === 'leader' && assigner) || (routeTab === 'kpi' && !fillsKpi) || (routeTab === 'upward' && !assigner && !bossing) ? 'open' : routeTab;
  const leaderRef = useRef<HTMLButtonElement>(null);
  const fromLeader = useMemo(() => assigner ? [] : assignedToKey(s.todos, s.meKey), [assigner, s.todos, s.meKey]);
  const own = useMemo(() => mine(s.todos, s.meKey), [s.todos, s.meKey]);
  const open = useMemo(() => openTodos(own), [own]);
  const groups = useMemo(() => groupDoneByMonth(own), [own]);
  const done = groups.reduce((n, g) => n + g.items.length, 0);
  const assignedOpen = useMemo(() => assigner ? assignedByKey(s.todos, s.meKey).filter(t => !isDone(t)).length : 0, [assigner, s.todos, s.meKey]);
  const upwardOpen = useMemo(() => (bossing ? assignedByKey(s.todos, s.meKey) : assigner ? assignedToKey(s.todos, s.meKey) : []).filter(t => !isDone(t)).length, [bossing, assigner, s.todos, s.meKey]);
  const upwardRef = useRef<HTMLButtonElement>(null);
  const [exporting, setExporting] = useState(false);
  // 生成OKR: this month, or the newest month with completed todos when this month has none yet.
  const okrMonth = groups.some(g => g.key === currentMonth()) || !groups.length ? currentMonth() : groups[0].key;
  const setTab = (t: TodoTab) => s.go(t === 'open' ? 'todos' : t === 'done' ? 'todos?tab=done' : 'todos?tab=' + t);
  return (
    <>
      <PageTitle title="待办事项" en="TODOS" description={fillsKpi ? '记录运营节奏；勾选完成即归档到「已完成」，按月回顾写周报与月报，月底填写当月绩效。' : '记录运营节奏；在「我指派的」给老师派任务，绩效评分请到「绩效考核」。'} />
      <div className="admin-tabs todo-tabs" role="tablist" aria-label="待办分类">
        <button role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'selected' : ''} onClick={() => setTab('open')}><ListTodo size={16} />待办<em>{open.length}</em></button>
        <button role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'selected' : ''} onClick={() => setTab('done')}><Check size={16} />已完成<em>{done}</em></button>
        {fillsKpi && <button role="tab" aria-selected={tab === 'kpi'} className={tab === 'kpi' ? 'selected' : ''} onClick={() => setTab('kpi')}><Target size={16} />当月绩效</button>}
        {assigner && <button role="tab" aria-selected={tab === 'assigned'} className={tab === 'assigned' ? 'selected' : ''} onClick={() => setTab('assigned')}><Send size={16} />我指派的<em>{assignedOpen}</em></button>}
        {!assigner && <button ref={leaderRef} role="tab" aria-selected={tab === 'leader'} className={'leader-tab' + (tab === 'leader' ? ' selected' : '')} onClick={() => setTab('leader')}><Crown size={16} /><HuskyLabel text="领导万岁" hostRef={leaderRef} /><em>{fromLeader.filter(t => !isDone(t)).length}</em></button>}
        {(assigner || bossing) && <button ref={upwardRef} role="tab" aria-selected={tab === 'upward'} className={'leader-tab' + (tab === 'upward' ? ' selected' : '')} onClick={() => setTab('upward')}><Sparkles size={16} /><HuskyLabel text="以下犯上" hostRef={upwardRef} /><em>{upwardOpen}</em></button>}
      </div>
      {tab === 'open' && (
        <section className="glass panel" role="tabpanel" aria-label="待办">
          <AddTodoForm />
          <div className="results-meta">{open.length} 项待办<span>按期望DDL排序</span></div>
          <div className="todo-list">
            {open.map(t => <TodoRow key={t.id} todo={t} mode="open" />)}
            {!open.length && <EmptyState icon={Inbox} title="暂无待办" description="在上方输入标题、选择期望DDL，添加第一项待办。" />}
          </div>
        </section>
      )}
      {tab === 'done' && (
        <div role="tabpanel" aria-label="已完成">
          <div className="results-meta done-meta">{done} 项已完成<span>按完成时间倒序 · 可恢复或删除<GenerateOkrButton month={okrMonth} count={groups.find(g => g.key === okrMonth)?.items.length || 0} /><button type="button" className="secondary compact export-button" onClick={() => setExporting(true)}><Share2 size={15} />一键导出</button></span></div>
          {!groups.length && <section className="glass panel"><EmptyState icon={Check} title="还没有已完成的待办" description="在「待办」中勾选完成的事项会按月归档到这里。" /></section>}
          {groups.map(g => (
            <section className="glass panel todo-month" key={g.key}>
              <SectionTitle title={g.label} sub={`${g.items.length} 项`} />
              <div className="todo-list">
                {g.items.map(t => <TodoRow key={t.id} todo={t} mode="done" />)}
              </div>
            </section>
          ))}
          {exporting && <ExportDoneDialog open={exporting} onClose={() => setExporting(false)} todos={own} initialMonth={currentMonth()} />}
        </div>
      )}
      {tab === 'kpi' && fillsKpi && <KpiSelfPanel />}
      {tab === 'assigned' && assigner && <AssignedPanel />}
      {tab === 'leader' && !assigner && <LeaderPanel list={fromLeader} />}
      {tab === 'upward' && (assigner || bossing) && <UpwardPanel />}
    </>
  );
}

/** Old #/todos-done links land on the 「已完成」 tab. */
export function TodosDoneRedirect() {
  const s = useNexus();
  useEffect(() => { s.go('todos?tab=done'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
