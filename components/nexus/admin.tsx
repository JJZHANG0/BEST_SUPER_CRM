'use client';
/** 系统管理 (superadmin): users, 项目编号, 课程 (with CSV import) and 班型与津贴标准. */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { UserPlus, KeyRound, Pencil, Trash2, Upload, Download, Plus, Copy, ShieldCheck, FolderKanban, BookOpenCheck, Users, BadgeJapaneseYen, Ban, CircleCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import { useNexus } from '@/lib/nexus/store';
import type { AdminUser } from '@/lib/nexus/api';
import { canManageSystem, roleLabels, isOpsLike, type Role } from '@/lib/nexus/roles';
import {
  allowanceUnits, courseStatuses, importCourses, newRecordId, statusFromDates, toCsv, unitLabel, courseCsvColumns,
  type ClassType, type CourseStatus, type OpsCourse, type Project, type CourseImport,
} from '@/lib/nexus/ops';
import { Badge, PageTitle, SearchBox, FormField, Picker, EmptyState, Notice } from './ui';

const tabs = [
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'projects', label: '项目管理', icon: FolderKanban },
  { id: 'courses', label: '课程管理', icon: BookOpenCheck },
  { id: 'class-types', label: '班型与津贴', icon: BadgeJapaneseYen },
] as const;
type Tab = typeof tabs[number]['id'];
const statusTone = (st: string) => st === '进行中' ? 'green' : st === '已结束' ? 'neutral' : 'violet';
const roleOptions = (['superadmin', 'ops', 'sales'] as Role[]).map(r => ({ value: r, label: roleLabels[r] }));
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdminPage() {
  const s = useNexus();
  const initial = new URLSearchParams(s.route.split('?')[1]).get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(tabs.some(t => t.id === initial) ? initial! : 'users');
  if (!canManageSystem(s.role)) return <EmptyState icon={ShieldCheck} title="仅超级管理员可访问" description="系统管理用于维护账号、项目、课程与津贴标准，如需调整请联系超级管理员。" />;
  return <>
    <PageTitle title="系统管理" en="SYSTEM ADMIN" description="维护运营部账号、项目编号、课程与教务津贴标准。" />
    <div className="admin-tabs" role="tablist">{tabs.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'selected' : ''} onClick={() => { setTab(t.id); window.history.replaceState(null, '', '#/admin?tab=' + t.id); }}><t.icon size={16} />{t.label}</button>)}</div>
    {tab === 'users' && <UsersTab />}
    {tab === 'projects' && <ProjectsTab />}
    {tab === 'courses' && <CoursesTab />}
    {tab === 'class-types' && <ClassTypesTab />}
  </>;
}

function PasswordReveal({ info, onClose }: { info: { name: string; email: string; password: string } | null; onClose: () => void }) {
  const copy = async () => { if (!info) return; try { await navigator.clipboard.writeText(`账号：${info.email}\n初始密码：${info.password}\n首次登录后请修改密码。`); toast.success('已复制'); } catch { toast.error('浏览器限制了复制，请手动选择文字'); } };
  return <Dialog open={!!info} onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog">
    <DialogTitle>初始密码</DialogTitle>
    <DialogDescription>此密码只显示这一次。请通过安全渠道发给 {info?.name}，对方首次登录时需要修改。</DialogDescription>
    <dl className="password-reveal"><div><dt>登录账号</dt><dd>{info?.email}</dd></div><div><dt>初始密码</dt><dd><code>{info?.password}</code></dd></div></dl>
    <div className="actions"><button className="secondary" onClick={copy}><Copy size={16} />复制账号与密码</button><button className="primary" onClick={onClose}>我已保存</button></div>
  </DialogContent></Dialog>;
}

function UsersTab() {
  const s = useNexus();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [reveal, setReveal] = useState<{ name: string; email: string; password: string } | null>(null);
  const load = async () => { try { setUsers(await s.admin.list()); } catch { toast.error('加载用户失败'); setUsers([]); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- (re)load from the API / demo directory
  useEffect(() => { void load(); }, [s.staff]);
  const list = (users || []).filter(u => (u.name + u.email).toLowerCase().includes(q.trim().toLowerCase()));
  const update = async (u: AdminUser, patch: { name?: string; role?: Role; active?: boolean }) => { const err = await s.admin.update(u, patch); if (err) { toast.error(err); return false; } toast.success('已保存'); await load(); return true; };
  const reset = async (u: AdminUser) => { if (!window.confirm(`为 ${u.name} 生成新的初始密码？旧密码将立即失效。`)) return; const r = await s.admin.resetPassword(u); if (!r.ok) return toast.error(r.error); setReveal({ name: u.name, email: u.email, password: r.password }); await load(); };
  return <section className="glass panel">
    <div className="filter-toolbar"><SearchBox value={q} onChange={setQ} placeholder="搜索姓名或登录账号" /><button className="primary compact push-right" onClick={() => setCreating(true)}><UserPlus size={16} />新建账号</button></div>
    {!s.apiMode && <Notice>预览站说明：账号的新增、停用、改密只保存在当前浏览器，正式环境由服务器统一管理。</Notice>}
    <div className="results-meta">{list.length} 个账号<span>运营老师 {list.filter(u => isOpsLike(u.role)).length} 位 · 超级管理员 {list.filter(u => u.role === 'superadmin').length} 位</span></div>
    {users === null ? <p className="muted">正在加载…</p> : list.length ? <div className="ops-table-wrap"><Table className="ops-table"><TableHeader><TableRow>{['姓名', '登录账号', '角色', '状态', ''].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{list.map(u => { const self = u.email === s.user?.email; return <TableRow key={u.email} className={u.active ? '' : 'is-disabled'}>
        <TableCell><span className="user-cell"><span className="avatar small-avatar">{u.name.slice(0, 1)}</span><strong className="cell-title">{u.name}</strong>{self && <Badge tone="neutral">我</Badge>}</span></TableCell>
        <TableCell className="mono">{u.email}</TableCell>
        <TableCell><Badge tone={u.role === 'superadmin' ? 'violet' : u.role === 'sales' ? 'neutral' : 'green'}>{roleLabels[u.role] || u.role}</Badge></TableCell>
        <TableCell>{u.active ? (u.mustChangePassword ? <Badge tone="orange">待首次改密</Badge> : <Badge tone="green">已启用</Badge>) : <Badge tone="neutral">已停用</Badge>}</TableCell>
        <TableCell className="row-actions">
          <button className="icon-button" title="编辑" aria-label={`编辑${u.name}`} onClick={() => setEditing(u)}><Pencil size={15} /></button>
          <button className="icon-button" title="重置密码" aria-label={`重置${u.name}的密码`} onClick={() => reset(u)}><KeyRound size={15} /></button>
          {!self && <button className="icon-button" title={u.active ? '停用' : '启用'} aria-label={u.active ? `停用${u.name}` : `启用${u.name}`} onClick={() => update(u, { active: !u.active })}>{u.active ? <Ban size={15} /> : <CircleCheck size={15} />}</button>}
        </TableCell>
      </TableRow>; })}</TableBody></Table></div> : <EmptyState icon={Users} title="没有匹配的账号" />}
    {creating && <UserDialog onClose={() => setCreating(false)} onSaved={async (info) => { setCreating(false); setReveal(info); await load(); }} />}
    {editing && <UserEditDialog user={editing} onClose={() => setEditing(null)} onSave={async patch => { if (await update(editing, patch)) setEditing(null); }} />}
    <PasswordReveal info={reveal} onClose={() => setReveal(null)} />
  </section>;
}

function UserDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (info: { name: string; email: string; password: string }) => void }) {
  const s = useNexus();
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [role, setRole] = useState<Role>('ops'), [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); const r = await s.admin.create({ name, email, role }); setBusy(false); if (!r.ok) return toast.error(r.error); onSaved({ name: name.trim(), email: email.trim().toLowerCase(), password: r.password }); };
  return <Dialog open onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog">
    <DialogTitle>新建账号</DialogTitle><DialogDescription>系统会生成随机初始密码，对方首次登录时需要修改。</DialogDescription>
    <form className="form-stack" onSubmit={submit}>
      <FormField label="姓名"><input required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="例如：王小明" /></FormField>
      <FormField label="登录账号（建议：姓名全拼@nexus.local）"><input required type="email" maxLength={120} value={email} onChange={e => setEmail(e.target.value)} placeholder="wangxiaoming@nexus.local" /></FormField>
      <FormField label="角色"><Picker label="角色" value={role} onChange={v => setRole(v as Role)} options={roleOptions} /></FormField>
      <div className="actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={busy} type="submit">创建并生成密码</button></div>
    </form>
  </DialogContent></Dialog>;
}
function UserEditDialog({ user, onClose, onSave }: { user: AdminUser; onClose: () => void; onSave: (patch: { name?: string; role?: Role }) => void }) {
  const s = useNexus(); const self = user.email === s.user?.email;
  const [name, setName] = useState(user.name), [role, setRole] = useState<Role>(user.role);
  return <Dialog open onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog">
    <DialogTitle>编辑账号</DialogTitle><DialogDescription>{user.email}</DialogDescription>
    <form className="form-stack" onSubmit={e => { e.preventDefault(); onSave({ ...(name.trim() !== user.name ? { name: name.trim() } : {}), ...(role !== user.role ? { role } : {}) }); }}>
      <FormField label="姓名"><input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></FormField>
      <FormField label={self ? '角色（不能修改自己的角色）' : '角色'}>{self ? <input value={roleLabels[user.role]} disabled /> : <Picker label="角色" value={role} onChange={v => setRole(v as Role)} options={roleOptions} />}</FormField>
      <div className="actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" type="submit">保存</button></div>
    </form>
  </DialogContent></Dialog>;
}

function ProjectsTab() {
  const s = useNexus();
  const [q, setQ] = useState(''), [editing, setEditing] = useState<Project | null>(null), [open, setOpen] = useState(false);
  const list = s.projects.filter(p => (p.code + p.name).toLowerCase().includes(q.trim().toLowerCase()));
  const count = (id: string) => s.opsCourses.filter(c => c.project === id).length;
  const remove = async (p: Project) => {
    if (count(p.id)) return toast.error('该项目下还有课程，请先删除或移动课程');
    if (!window.confirm(`删除项目 ${p.code}？`)) return;
    if (await s.removeRecord('projects', p.id)) toast.success('已删除');
  };
  return <section className="glass panel">
    <div className="filter-toolbar"><SearchBox value={q} onChange={setQ} placeholder="搜索项目编号或名称" /><button className="primary compact push-right" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16} />新建项目</button></div>
    <div className="results-meta">{list.length} 个项目<span>项目编号示例：COND2025001</span></div>
    {list.length ? <div className="ops-table-wrap"><Table className="ops-table"><TableHeader><TableRow>{['项目编号', '项目名称', '起始日期', '终止日期', '状态', '课程数', ''].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{list.map(p => <TableRow key={p.id}>
        <TableCell className="mono"><strong className="cell-title">{p.code}</strong></TableCell>
        <TableCell>{p.name}{p.note && <small className="cell-sub">{p.note}</small>}</TableCell>
        <TableCell className="nowrap">{p.startDate || '—'}</TableCell><TableCell className="nowrap">{p.endDate || '—'}</TableCell>
        <TableCell><Badge tone={statusTone(p.status)}>{p.status}</Badge></TableCell>
        <TableCell className="num">{count(p.id)}</TableCell>
        <TableCell className="row-actions"><button className="icon-button" title="编辑" aria-label={`编辑${p.code}`} onClick={() => { setEditing(p); setOpen(true); }}><Pencil size={15} /></button><button className="icon-button" title="删除" aria-label={`删除${p.code}`} onClick={() => remove(p)}><Trash2 size={15} /></button></TableCell>
      </TableRow>)}</TableBody></Table></div>
      : <EmptyState icon={FolderKanban} title={s.projects.length ? '没有匹配的项目' : '还没有项目'} description="新建项目编号，或在课程管理中导入课程表时自动创建。" action="新建项目" onAction={() => { setEditing(null); setOpen(true); }} />}
    {open && <ProjectDialog project={editing} onClose={() => setOpen(false)} />}
  </section>;
}
function ProjectDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const s = useNexus();
  const [code, setCode] = useState(project?.code || ''), [name, setName] = useState(project?.name || ''), [startDate, setStart] = useState(project?.startDate || ''), [endDate, setEnd] = useState(project?.endDate || ''), [status, setStatus] = useState<CourseStatus>(project?.status || '未开始'), [note, setNote] = useState(project?.note || '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,40}$/.test(c)) return toast.error('项目编号只能包含字母、数字和短横线（3–40 位）');
    if (s.projects.some(p => p.code.toUpperCase() === c && p.id !== project?.id)) return toast.error('项目编号已存在');
    if (startDate && endDate && endDate < startDate) return toast.error('终止日期不能早于起始日期');
    const rec: Project = { id: project?.id || newRecordId('P'), code: c, name: name.trim() || c, startDate, endDate, status, note: note.trim() };
    s.setProjects(l => project ? l.map(x => x.id === rec.id ? rec : x) : [...l, rec]);
    s.log((project ? '修改项目：' : '新建项目：') + c); toast.success('项目已保存'); onClose();
  };
  return <Dialog open onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog">
    <DialogTitle>{project ? '编辑项目' : '新建项目'}</DialogTitle><DialogDescription>项目编号用于关联课程，例如 COND2025001。</DialogDescription>
    <form className="form-stack" onSubmit={submit}>
      <div className="form-columns"><FormField label="项目编号"><input required maxLength={40} value={code} onChange={e => setCode(e.target.value)} placeholder="COND2025001" /></FormField><FormField label="状态"><Picker label="状态" value={status} onChange={v => setStatus(v as CourseStatus)} options={courseStatuses.map(x => ({ value: x, label: x }))} /></FormField></div>
      <FormField label="项目名称"><input maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="例如：康莱德 2025 秋季线上小组课" /></FormField>
      <div className="form-columns"><FormField label="起始日期"><input type="date" value={startDate} onChange={e => setStart(e.target.value)} /></FormField><FormField label="终止日期"><input type="date" value={endDate} onChange={e => setEnd(e.target.value)} /></FormField></div>
      <FormField label="备注（可选）"><textarea rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></FormField>
      <div className="actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" type="submit">保存项目</button></div>
    </form>
  </DialogContent></Dialog>;
}

function CoursesTab() {
  const s = useNexus();
  const [q, setQ] = useState(''), [project, setProject] = useState('__all'), [status, setStatus] = useState('__all');
  const [editing, setEditing] = useState<OpsCourse | null>(null), [open, setOpen] = useState(false), [importing, setImporting] = useState(false);
  const list = s.opsCourses.filter(c => (project === '__all' || c.project === project) && (status === '__all' || c.status === status) && (c.code + c.name + c.teacher + s.staffName(c.opsTeacher)).toLowerCase().includes(q.trim().toLowerCase()));
  const type = (id: string) => s.classTypes.find(t => t.id === id);
  const code = (id: string) => s.projects.find(p => p.id === id)?.code || '—';
  const rateText = (t?: ClassType) => t ? `¥${t.rate} ${unitLabel(t.unit)}` : '—';
  const used = (id: string) => s.lessons.some(l => l.course === id) || s.lessonFeedbacks.some(f => f.course === id);
  const remove = async (c: OpsCourse) => { if (used(c.id)) return toast.error('该课程已有课时记录或反馈，不能删除，可将状态改为已结束'); if (!window.confirm(`删除课程 ${c.code}？`)) return; if (await s.removeRecord('opsCourses', c.id)) toast.success('已删除'); };
  const exportCsv = () => download('课程列表.csv', toCsv([[...courseCsvColumns], ...list.map(c => { const t = type(c.classType); return [code(c.project), c.code, c.status, c.name, t?.name || '', t ? `¥${t.rate}` : '', c.teacher, s.staffName(c.opsTeacher), c.startDate, c.endDate]; })]));
  return <section className="glass panel">
    <div className="filter-toolbar ops-filters"><SearchBox value={q} onChange={setQ} placeholder="搜索课程编号、名称或老师" />
      <Picker label="项目" value={project} onChange={setProject} options={[{ value: '__all', label: '全部项目' }, ...s.projects.map(p => ({ value: p.id, label: p.code }))]} />
      <Picker label="课程状态" value={status} onChange={setStatus} options={[{ value: '__all', label: '全部状态' }, ...courseStatuses.map(x => ({ value: x, label: x }))]} />
      <div className="push-right toolbar-buttons"><button className="secondary compact" onClick={() => setImporting(true)}><Upload size={16} />CSV 导入</button><button className="primary compact" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16} />新建课程</button></div>
    </div>
    <div className="results-meta">{list.length} 门课程<span>津贴标准由班级类型决定{list.length > 0 && <button className="text-button inline-action" onClick={exportCsv}><Download size={14} />导出 CSV</button>}</span></div>
    {list.length ? <div className="ops-table-wrap"><Table className="ops-table courses-table"><TableHeader><TableRow>{['项目编号', '课程编号', '课程状态', '课程名称', '班级类型', '津贴标准', '授课老师', '教务老师', '起始日期', '终止日期', ''].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{list.map(c => { const t = type(c.classType); return <TableRow key={c.id}>
        <TableCell className="mono nowrap">{code(c.project)}</TableCell><TableCell className="mono nowrap"><strong className="cell-title">{c.code}</strong></TableCell>
        <TableCell><Badge tone={c.status === '已结束' ? 'pink' : statusTone(c.status)}>{c.status}</Badge></TableCell>
        <TableCell>{c.name}</TableCell><TableCell><span className="type-chip">{t?.name || '未知班型'}</span></TableCell><TableCell className="nowrap">{rateText(t)}</TableCell>
        <TableCell>{c.teacher || '—'}</TableCell><TableCell>{c.opsTeacher ? <span className="type-chip ops">{s.staffName(c.opsTeacher)}</span> : '—'}</TableCell>
        <TableCell className="nowrap">{c.startDate || '—'}</TableCell><TableCell className="nowrap">{c.endDate || '—'}</TableCell>
        <TableCell className="row-actions"><button className="icon-button" title="编辑" aria-label={`编辑${c.code}`} onClick={() => { setEditing(c); setOpen(true); }}><Pencil size={15} /></button><button className="icon-button" title="删除" aria-label={`删除${c.code}`} onClick={() => remove(c)}><Trash2 size={15} /></button></TableCell>
      </TableRow>; })}</TableBody></Table></div>
      : <EmptyState icon={BookOpenCheck} title={s.opsCourses.length ? '没有匹配的课程' : '还没有课程'} description="可逐门新建，也可以把课时记录表（项目编号、课程编号、课程状态、课程名称、班级类型…）另存为 CSV 一次导入。" action="CSV 导入课程" onAction={() => setImporting(true)} />}
    {open && <CourseDialog course={editing} onClose={() => setOpen(false)} />}
    {importing && <ImportDialog onClose={() => setImporting(false)} />}
  </section>;
}
function CourseDialog({ course, onClose }: { course: OpsCourse | null; onClose: () => void }) {
  const s = useNexus();
  const types = s.classTypes.filter(t => t.active || t.id === course?.classType);
  const [code, setCode] = useState(course?.code || ''), [project, setProject] = useState(course?.project || s.projects[0]?.id || ''), [name, setName] = useState(course?.name || ''), [classType, setClassType] = useState(course?.classType || types[0]?.id || ''), [teacher, setTeacher] = useState(course?.teacher || ''), [opsTeacher, setOps] = useState(course?.opsTeacher || ''), [startDate, setStart] = useState(course?.startDate || ''), [endDate, setEnd] = useState(course?.endDate || ''), [status, setStatus] = useState<CourseStatus>(course?.status || '未开始');
  const t = s.classTypes.find(x => x.id === classType);
  if (!s.projects.length) return <Dialog open onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog"><DialogTitle>新建课程</DialogTitle><DialogDescription>课程需要归属一个项目编号。</DialogDescription><EmptyState icon={FolderKanban} title="请先新建项目" description="在「项目管理」中添加项目编号后再创建课程，或使用 CSV 导入自动创建项目。" /></DialogContent></Dialog>;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return toast.error('请填写课程编号');
    if (s.opsCourses.some(x => x.code === c && x.id !== course?.id)) return toast.error('课程编号已存在');
    if (!project || !classType) return toast.error('请选择项目和班级类型');
    if (startDate && endDate && endDate < startDate) return toast.error('终止日期不能早于起始日期');
    const rec: OpsCourse = { id: course?.id || newRecordId('OC'), code: c, project, name: name.trim(), status, classType, teacher: teacher.trim(), opsTeacher, startDate, endDate };
    s.setOpsCourses(l => course ? l.map(x => x.id === rec.id ? rec : x) : [...l, rec]);
    s.log((course ? '修改课程：' : '新建课程：') + c); toast.success('课程已保存'); onClose();
  };
  return <Dialog open onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog wide">
    <DialogTitle>{course ? '编辑课程' : '新建课程'}</DialogTitle><DialogDescription>字段与课时记录表一致；津贴标准随班级类型自动带出。</DialogDescription>
    <form className="form-stack" onSubmit={submit}>
      <div className="form-columns"><FormField label="项目编号"><Picker label="项目编号" value={project} onChange={setProject} options={s.projects.map(p => ({ value: p.id, label: p.code + (p.name !== p.code ? ' · ' + p.name : '') }))} /></FormField><FormField label="课程编号"><input required maxLength={60} value={code} onChange={e => setCode(e.target.value)} placeholder="COND02501-11A" /></FormField></div>
      <FormField label="课程名称"><input required maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="COND 星跃 商业(11月线上小组课)" /></FormField>
      <div className="form-columns"><FormField label="班级类型"><Picker label="班级类型" value={classType} onChange={setClassType} options={types.map(x => ({ value: x.id, label: x.name }))} /></FormField><FormField label="津贴标准"><input disabled value={t ? `¥${t.rate} ${unitLabel(t.unit)}` : ''} /></FormField></div>
      <div className="form-columns"><FormField label="授课老师"><input maxLength={80} value={teacher} onChange={e => setTeacher(e.target.value)} placeholder="例如：Dora" /></FormField><FormField label="教务老师"><Picker label="教务老师" value={opsTeacher} onChange={setOps} options={[{ value: '', label: '未指定' }, ...s.staff.filter(u => u.active || u.email === opsTeacher).map(u => ({ value: u.email, label: u.name }))]} /></FormField></div>
      <div className="form-columns three"><FormField label="起始日期"><input type="date" value={startDate} onChange={e => { setStart(e.target.value); if (!course) setStatus(statusFromDates(e.target.value, endDate)); }} /></FormField><FormField label="终止日期"><input type="date" value={endDate} onChange={e => { setEnd(e.target.value); if (!course) setStatus(statusFromDates(startDate, e.target.value)); }} /></FormField><FormField label="课程状态"><Picker label="课程状态" value={status} onChange={v => setStatus(v as CourseStatus)} options={courseStatuses.map(x => ({ value: x, label: x }))} /></FormField></div>
      <div className="actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" type="submit">保存课程</button></div>
    </form>
  </DialogContent></Dialog>;
}
function ImportDialog({ onClose }: { onClose: () => void }) {
  const s = useNexus();
  const [text, setText] = useState('');
  const result: CourseImport | null = useMemo(() => text.trim() ? importCourses(text, { classTypes: s.classTypes, projects: s.projects, courses: s.opsCourses, staff: s.staff, newId: newRecordId }) : null, [text, s.classTypes, s.projects, s.opsCourses, s.staff]);
  const template = () => download('课程导入模板.csv', toCsv([[...courseCsvColumns], ['COND2025001', 'COND02501-11A', '已结束', 'COND 星跃 商业(11月线上小组课)', '2. 线上3-5人', '¥15', '陈佳浩Venti', s.staff[0]?.name || '张捷嘉', '2025年9月6日', '2026年1月16日']]));
  const apply = () => {
    if (!result || !result.courses.length) return;
    if (result.projects.length) s.setProjects(l => [...l, ...result.projects]);
    s.setOpsCourses(l => { const byId = new Map(result.courses.map(c => [c.id, c])); const kept = l.map(c => byId.get(c.id) ?? c); const added = result.courses.filter(c => !l.some(x => x.id === c.id)); return [...kept, ...added]; });
    s.log(`导入课程：新增 ${result.created}，更新 ${result.updated}`);
    toast.success(`已导入：新增 ${result.created} 门，更新 ${result.updated} 门${result.projects.length ? `，新建项目 ${result.projects.length} 个` : ''}`);
    onClose();
  };
  return <Dialog open onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog wide">
    <DialogTitle>CSV 导入课程</DialogTitle>
    <DialogDescription>在表格软件中选中含表头的区域另存为 CSV（或直接复制粘贴），列名需包含：{courseCsvColumns.join('、')}。津贴标准列会被忽略，以班级类型为准；相同课程编号将更新原课程。</DialogDescription>
    <div className="form-stack">
      <div className="actions"><label className="secondary file-button"><Upload size={16} />选择 CSV 文件<input type="file" accept=".csv,text/csv,.txt" onChange={async e => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} /></label><button type="button" className="text-button" onClick={template}><Download size={14} />下载模板</button></div>
      <FormField label="或粘贴表格内容"><textarea rows={7} value={text} onChange={e => setText(e.target.value)} placeholder={courseCsvColumns.join(',')} className="mono" /></FormField>
      {result && <div className="import-preview">
        <p><b>{result.created}</b> 门新课程 · <b>{result.updated}</b> 门更新{result.projects.length > 0 && <> · 新建项目 <b>{result.projects.map(p => p.code).join('、')}</b></>}</p>
        {result.issues.length > 0 && <ul className="import-issues">{result.issues.slice(0, 12).map(i => <li key={i.line + i.message}>第 {i.line} 行：{i.message}</li>)}{result.issues.length > 12 && <li>…另有 {result.issues.length - 12} 行问题</li>}</ul>}
      </div>}
      <div className="actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={!result?.courses.length} onClick={apply}>导入 {result?.courses.length || 0} 门课程</button></div>
    </div>
  </DialogContent></Dialog>;
}

function ClassTypesTab() {
  const s = useNexus();
  const [drafts, setDrafts] = useState<Record<string, ClassType>>({});
  const rowOf = (t: ClassType) => drafts[t.id] ?? t;
  const edit = (t: ClassType, patch: Partial<ClassType>) => setDrafts(d => ({ ...d, [t.id]: { ...rowOf(t), ...patch } }));
  const dirty = (t: ClassType) => !!drafts[t.id] && JSON.stringify(drafts[t.id]) !== JSON.stringify(t);
  const save = (t: ClassType) => { const r = rowOf(t); if (!r.name.trim()) return toast.error('请填写班级类型名称'); if (!(r.rate >= 0)) return toast.error('津贴标准需为非负数'); s.setClassTypes(l => l.map(x => x.id === t.id ? { ...r, name: r.name.trim(), note: r.note.trim() } : x)); setDrafts(d => { const n = { ...d }; delete n[t.id]; return n; }); s.log('修改津贴标准：' + r.name); toast.success('已保存，新的课时记录将按新标准计算'); };
  const add = () => { const id = newRecordId('CT'); s.setClassTypes(l => [...l, { id, name: '新班级类型', rate: 0, unit: 'hour', note: '', active: true }]); };
  const remove = async (t: ClassType) => { if (s.opsCourses.some(c => c.classType === t.id)) return toast.error('已有课程使用该班型，可改为停用'); if (!window.confirm(`删除班级类型「${t.name}」？`)) return; if (await s.removeRecord('classTypes', t.id)) toast.success('已删除'); };
  return <section className="glass panel">
    <div className="filter-toolbar"><div className="toolbar-text"><strong>教务津贴标准</strong><small>按班级类型计算：元/小时 × 课时；元/人/小时 × 人数 × 课时；元/次 按每条记录计一次。修改只影响之后新建的课时记录。</small></div><button className="primary compact push-right" onClick={add}><Plus size={16} />新增班型</button></div>
    <Notice>7、8 号「部分教务工作」及线下 6/7/8/11 人班型在原表中未注明单位，已默认按「元/小时」计算，可在下方调整。</Notice>
    <div className="ops-table-wrap"><Table className="ops-table class-type-table"><TableHeader><TableRow>{['班级类型', '教务津贴标准', '计费单位', '备注说明', '启用', ''].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{s.classTypes.map(t => { const r = rowOf(t); return <TableRow key={t.id} className={r.active ? '' : 'is-disabled'}>
        <TableCell><input className="cell-input" aria-label="班级类型名称" value={r.name} maxLength={80} onChange={e => edit(t, { name: e.target.value })} /></TableCell>
        <TableCell><span className="rate-input">¥<input className="cell-input" aria-label="津贴标准" type="number" min="0" step="0.5" value={r.rate} onChange={e => edit(t, { rate: Number(e.target.value) })} /></span></TableCell>
        <TableCell><Picker label="计费单位" className="cell-choice" value={r.unit} onChange={v => edit(t, { unit: v as ClassType['unit'] })} options={allowanceUnits.map(u => ({ value: u.value, label: u.label }))} /></TableCell>
        <TableCell><input className="cell-input" aria-label="备注说明" value={r.note} maxLength={200} onChange={e => edit(t, { note: e.target.value })} /></TableCell>
        <TableCell><input type="checkbox" aria-label="启用" checked={r.active} onChange={e => edit(t, { active: e.target.checked })} /></TableCell>
        <TableCell className="row-actions">{dirty(t) && <button className="primary compact" onClick={() => save(t)}>保存</button>}<button className="icon-button" title="删除" aria-label={`删除${t.name}`} onClick={() => remove(t)}><Trash2 size={15} /></button></TableCell>
      </TableRow>; })}</TableBody></Table></div>
    {!s.classTypes.length && <EmptyState icon={BadgeJapaneseYen} title="还没有班级类型" action="新增班型" onAction={add} />}
  </section>;
}
