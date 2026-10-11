'use client';
/** 课时记录 (lesson hours + 教务津贴) and 课情反馈 (lesson feedback) for ops teachers. */
import { useMemo, useState, type FormEvent } from 'react';
import { Clock, Download, Pencil, Trash2, MessageSquareText, BookOpenCheck, Link2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import { useNexus } from '@/lib/nexus/store';
import { canSeeAllLessons, canManageSystem } from '@/lib/nexus/roles';
import {
  computeAllowance, currentMonth, today, monthOf, monthLabel, money2, unitLabel, needsStudents, summarizeByTeacher,
  visibleLessons, monthAllowance, toCsv, newRecordId, type LessonRecord, type LessonFeedback, type OpsCourse,
} from '@/lib/nexus/ops';
import { Badge, PageTitle, SearchBox, FormField, Picker, EmptyState } from './ui';

const ALL = '__all';
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const confirmDelete = (what: string) => window.confirm(`确定删除这条${what}？删除后无法恢复。`);

/** Shared filter state + helpers for both pages. */
function useOpsFilters() {
  const s = useNexus();
  const all = canSeeAllLessons(s.role);
  const params = new URLSearchParams(s.route.split('?')[1]);
  const [month, setMonth] = useState(params.get('month') || currentMonth());
  const [project, setProject] = useState(ALL);
  const [teacher, setTeacher] = useState(ALL);
  const [q, setQ] = useState('');
  const course = (id: string) => s.opsCourses.find(c => c.id === id);
  const matches = (r: { course: string; date: string; opsTeacher: string }) => {
    const c = course(r.course);
    if (month && monthOf(r.date) !== month) return false;
    if (project !== ALL && c?.project !== project) return false;
    if (all && teacher !== ALL && r.opsTeacher.toLowerCase() !== teacher.toLowerCase()) return false;
    const hay = ((c?.code || '') + (c?.name || '') + (c?.teacher || '')).toLowerCase();
    return !q.trim() || hay.includes(q.trim().toLowerCase());
  };
  const toolbar = (
    <div className="filter-toolbar ops-filters">
      <SearchBox value={q} onChange={setQ} placeholder="搜索课程编号、名称或授课老师" />
      <label className="month-field"><CalendarDays size={15} /><input type="month" aria-label="月份" value={month} onChange={e => setMonth(e.target.value)} /></label>
      <Picker label="项目" value={project} onChange={setProject} options={[{ value: ALL, label: '全部项目' }, ...s.projects.map(p => ({ value: p.id, label: p.code + ' ' + (p.name !== p.code ? p.name : '') }))]} />
      {all && <Picker label="教务老师" value={teacher} onChange={setTeacher} options={[{ value: ALL, label: '全部教务老师' }, ...s.staff.map(u => ({ value: u.email, label: u.name }))]} />}
    </div>
  );
  return { s, all, month, matches, toolbar, course };
}

/** Courses the signed-in user may log against: own + unassigned (superadmin: all). */
function loggableCourses(courses: OpsCourse[], role: unknown, email: string) {
  if (canSeeAllLessons(role)) return courses;
  const me = email.toLowerCase();
  return courses.filter(c => !c.opsTeacher || c.opsTeacher.toLowerCase() === me);
}
const courseLabel = (c: OpsCourse) => `${c.code} · ${c.name}`;

function NoCourses() {
  const s = useNexus();
  return canManageSystem(s.role)
    ? <EmptyState icon={BookOpenCheck} title="还没有课程" description="先在系统管理中添加项目与课程（支持按表格列 CSV 批量导入），即可开始记录课时。" action="去添加课程" onAction={() => s.go('admin?tab=courses')} />
    : <EmptyState icon={BookOpenCheck} title="还没有分配给你的课程" description="课程由超级管理员在系统管理中创建并指定教务老师，创建后即可在这里记录课时。" />;
}

function LessonDialog({ record, open, onClose }: { record: LessonRecord | null; open: boolean; onClose: () => void }) {
  const s = useNexus();
  const me = s.user?.email || '';
  const all = canSeeAllLessons(s.role);
  const options = loggableCourses(s.opsCourses, s.role, me);
  const [courseId, setCourseId] = useState(record?.course || options[0]?.id || '');
  const [date, setDate] = useState(record?.date || today());
  const [hours, setHours] = useState(String(record?.hours ?? 2));
  const [students, setStudents] = useState(record?.students != null ? String(record.students) : '');
  const [ops, setOps] = useState(record?.opsTeacher || options[0]?.opsTeacher || me);
  const [note, setNote] = useState(record?.note || '');
  const course = s.opsCourses.find(c => c.id === courseId);
  const fresh = !record || record.course !== courseId;
  const type = s.classTypes.find(t => t.id === course?.classType);
  const rate = fresh ? type?.rate ?? 0 : record!.rate, unit = fresh ? type?.unit ?? 'hour' : record!.unit;
  const h = Number(hours), n = students === '' ? null : Number(students);
  const amount = computeAllowance(rate, unit, h, n);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!course || !type) return toast.error('请选择课程');
    if (!(h > 0 && h <= 24)) return toast.error('课时需在 0–24 小时之间');
    if (needsStudents(unit) && !(n && n > 0)) return toast.error('该班型按人数计算津贴，请填写学生人数');
    const owner = all ? (ops || me) : me;
    const rec: LessonRecord = { id: record?.id || newRecordId('L'), course: course.id, date, hours: h, students: n, opsTeacher: owner.toLowerCase(), rate, unit, amount, note: note.trim(), createdBy: record?.createdBy || me };
    s.setLessons(l => record ? l.map(x => x.id === rec.id ? rec : x) : [rec, ...l]);
    s.log((record ? '修改课时记录：' : '记录课时：') + course.code + ' ' + date);
    toast.success(record ? '课时记录已更新' : `已记录课时，津贴 ${money2(amount)}`);
    onClose();
  };
  return <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog">
    <DialogTitle>{record ? '编辑课时记录' : '记录课时'}</DialogTitle>
    <DialogDescription>津贴按课程的班级类型自动计算，记录时锁定当时的津贴标准。</DialogDescription>
    {!options.length ? <NoCourses /> : <form className="form-stack" onSubmit={submit}>
      <FormField label="课程"><Picker label="课程" value={courseId} onChange={v => { setCourseId(v); const c = s.opsCourses.find(x => x.id === v); if (c?.opsTeacher && all) setOps(c.opsTeacher); }} options={options.map(c => ({ value: c.id, label: courseLabel(c) }))} /></FormField>
      <div className="form-columns">
        <FormField label="上课日期"><input type="date" required value={date} onChange={e => setDate(e.target.value)} /></FormField>
        <FormField label="课时（小时）"><input type="number" required min="0.25" max="24" step="0.25" value={hours} onChange={e => setHours(e.target.value)} /></FormField>
      </div>
      <div className="form-columns">
        <FormField label={needsStudents(unit) ? '学生人数（按人计费，必填）' : '学生人数（可选）'}><input type="number" min="0" max="1000" step="1" value={students} required={needsStudents(unit)} onChange={e => setStudents(e.target.value)} placeholder="例如 6" /></FormField>
        <FormField label="教务老师">{all ? <Picker label="教务老师" value={ops} onChange={setOps} options={s.staff.filter(u => u.active || u.email === ops).map(u => ({ value: u.email, label: u.name }))} /> : <input value={s.staffName(me)} disabled />}</FormField>
      </div>
      <FormField label="备注（可选）"><textarea rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="例如：补课、调课说明" /></FormField>
      <div className="allowance-preview" aria-live="polite">
        <span>{type ? `${type.name} · ¥${rate} ${unitLabel(unit)}` : '未选择课程'}</span>
        <span>{unit === 'person_hour' ? `¥${rate} × ${n || 0} 人 × ${h || 0} 小时` : unit === 'session' ? `¥${rate} × 1 次` : `¥${rate} × ${h || 0} 小时`}</span>
        <b>{money2(amount)}</b>
      </div>
      <div className="actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" type="submit">{record ? '保存修改' : '保存课时'}</button></div>
    </form>}
  </DialogContent></Dialog>;
}

export function LessonsPage() {
  const { s, all, month, matches, toolbar, course } = useOpsFilters();
  const [editing, setEditing] = useState<LessonRecord | null>(null);
  const [open, setOpen] = useState(new URLSearchParams(s.route.split('?')[1]).has('new'));
  const me = s.user?.email || '';
  const rows = useMemo(() => visibleLessons(s.lessons, s.role, me).filter(matches).sort((a, b) => b.date.localeCompare(a.date)), [s.lessons, s.role, me, matches]);
  const total = rows.reduce((n, r) => n + r.amount, 0), hours = rows.reduce((n, r) => n + r.hours, 0);
  const summary = summarizeByTeacher(rows);
  const typeName = (c?: OpsCourse) => s.classTypes.find(t => t.id === c?.classType)?.name || '—';
  const exportCsv = () => {
    const head = ['日期', '项目编号', '课程编号', '课程名称', '班级类型', '课时(小时)', '学生人数', '津贴标准', '津贴(元)', '教务老师', '备注'];
    download(`课时记录-${month || '全部'}.csv`, toCsv([head, ...rows.map(r => { const c = course(r.course); return [r.date, s.projects.find(p => p.id === c?.project)?.code || '', c?.code || '', c?.name || '', typeName(c), r.hours, r.students ?? '', `${r.rate}${unitLabel(r.unit)}`, r.amount, s.staffName(r.opsTeacher), r.note]; })]));
  };
  const remove = async (r: LessonRecord) => { if (!confirmDelete('课时记录')) return; if (await s.removeRecord('lessons', r.id)) { s.setLessonFeedbacks(l => l.map(f => f.lesson === r.id ? { ...f, lesson: null } : f)); toast.success('已删除'); } };
  return <>
    <PageTitle title="课时记录" en="LESSON HOURS" description={all ? '查看全部教务老师的课时与当月教务津贴，按月份、项目与老师筛选。' : '记录你负责课程的课时，津贴按班级类型自动计算。'} action="记录课时" onAction={() => { setEditing(null); setOpen(true); }} />
    <div className="mini-stats ops-stats">
      <div className="glass"><span>{month ? monthLabel(month) : '全部月份'} · 津贴合计</span><b>{money2(total)}</b></div>
      <div className="glass"><span>课时合计</span><b>{Math.round(hours * 100) / 100}<small> 小时</small></b></div>
      <div className="glass"><span>记录条数</span><b>{rows.length}<small> 条</small></b></div>
      <div className="glass"><span>涉及课程</span><b>{new Set(rows.map(r => r.course)).size}<small> 门</small></b></div>
    </div>
    <section className="glass panel">
      {toolbar}
      {!s.opsCourses.length ? <NoCourses /> : <>
        {all && summary.length > 0 && <div className="teacher-summary">{summary.map(t => <div key={t.opsTeacher}><span className="avatar small-avatar">{s.staffName(t.opsTeacher).slice(0, 1)}</span><div><strong>{s.staffName(t.opsTeacher)}</strong><small>{t.count} 条 · {t.hours} 小时</small></div><b>{money2(t.amount)}</b></div>)}</div>}
        <div className="results-meta">{rows.length} 条记录<span>{all ? '超级管理员可查看全部老师' : '仅显示你的记录'}{rows.length > 0 && <button className="text-button inline-action" onClick={exportCsv}><Download size={14} />导出 CSV</button>}</span></div>
        {rows.length ? <div className="ops-table-wrap"><Table className="ops-table"><TableHeader><TableRow>{['日期', '课程', '班级类型', '课时', '人数', '津贴标准', '津贴', '教务老师', ''].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.map(r => { const c = course(r.course); return <TableRow key={r.id}>
            <TableCell className="nowrap">{r.date}</TableCell>
            <TableCell><strong className="cell-title">{c?.name || '已删除的课程'}</strong><small className="cell-sub">{c?.code}</small></TableCell>
            <TableCell>{typeName(c)}</TableCell>
            <TableCell className="num">{r.hours}</TableCell>
            <TableCell className="num">{r.students ?? '—'}</TableCell>
            <TableCell className="nowrap">¥{r.rate} {unitLabel(r.unit)}</TableCell>
            <TableCell className="num"><b>{money2(r.amount)}</b></TableCell>
            <TableCell>{s.staffName(r.opsTeacher)}</TableCell>
            <TableCell className="row-actions">
              <button className="icon-button" aria-label="写课情反馈" title="写课情反馈" onClick={() => s.go('lesson-feedback?new&lesson=' + r.id)}><MessageSquareText size={15} /></button>
              <button className="icon-button" aria-label="编辑" title="编辑" onClick={() => { setEditing(r); setOpen(true); }}><Pencil size={15} /></button>
              <button className="icon-button" aria-label="删除" title="删除" onClick={() => remove(r)}><Trash2 size={15} /></button>
            </TableCell>
          </TableRow>; })}</TableBody></Table></div>
          : <EmptyState icon={Clock} title={month ? `${monthLabel(month)}还没有课时记录` : '还没有课时记录'} description="每上完一节课记录一次，月底即可直接核对教务津贴。" action="记录课时" onAction={() => { setEditing(null); setOpen(true); }} />}
      </>}
    </section>
    {open && <LessonDialog key={editing?.id || 'new'} record={editing} open={open} onClose={() => { setOpen(false); setEditing(null); if (s.route.includes('new')) s.go('lessons'); }} />}
  </>;
}

function FeedbackDialog({ record, lessonId, open, onClose }: { record: LessonFeedback | null; lessonId?: string | null; open: boolean; onClose: () => void }) {
  const s = useNexus();
  const me = s.user?.email || '';
  const all = canSeeAllLessons(s.role);
  const options = loggableCourses(s.opsCourses, s.role, me);
  const fromLesson = lessonId ? s.lessons.find(l => l.id === lessonId) : undefined;
  const [courseId, setCourseId] = useState(record?.course || fromLesson?.course || options[0]?.id || '');
  const [date, setDate] = useState(record?.date || fromLesson?.date || today());
  const [lesson, setLesson] = useState(record?.lesson || fromLesson?.id || '');
  const [attendance, setAttendance] = useState(record?.attendance || (fromLesson?.students ? `${fromLesson.students} 人到课` : ''));
  const [content, setContent] = useState(record?.content || '');
  const [performance, setPerformance] = useState(record?.performance || '');
  const [issues, setIssues] = useState(record?.issues || '');
  const [nextSteps, setNextSteps] = useState(record?.nextSteps || '');
  const [ops, setOps] = useState(record?.opsTeacher || fromLesson?.opsTeacher || me);
  const lessonOptions = visibleLessons(s.lessons, s.role, me).filter(l => l.course === courseId).sort((a, b) => b.date.localeCompare(a.date));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!courseId) return toast.error('请选择课程');
    if (!content.trim()) return toast.error('请填写本次课程内容');
    const rec: LessonFeedback = { id: record?.id || newRecordId('LF'), course: courseId, lesson: lesson || null, date, attendance: attendance.trim(), content: content.trim(), performance: performance.trim(), issues: issues.trim(), nextSteps: nextSteps.trim(), opsTeacher: (all ? ops || me : me).toLowerCase(), createdBy: record?.createdBy || me };
    s.setLessonFeedbacks(l => record ? l.map(x => x.id === rec.id ? rec : x) : [rec, ...l]);
    s.log((record ? '修改课情反馈：' : '记录课情反馈：') + (s.opsCourses.find(c => c.id === courseId)?.code || '') + ' ' + date);
    toast.success(record ? '课情反馈已更新' : '课情反馈已保存');
    onClose();
  };
  return <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog wide">
    <DialogTitle>{record ? '编辑课情反馈' : '记录课情反馈'}</DialogTitle>
    <DialogDescription>记录每节课的到课、内容、表现与下一步，可关联到对应的课时记录。</DialogDescription>
    {!options.length ? <NoCourses /> : <form className="form-stack" onSubmit={submit}>
      <div className="form-columns">
        <FormField label="课程"><Picker label="课程" value={courseId} onChange={v => { setCourseId(v); setLesson(''); }} options={options.map(c => ({ value: c.id, label: courseLabel(c) }))} /></FormField>
        <FormField label="上课日期"><input type="date" required value={date} onChange={e => setDate(e.target.value)} /></FormField>
      </div>
      <div className="form-columns">
        <FormField label="关联课时记录（可选）"><Picker label="关联课时记录" value={lesson} onChange={v => { setLesson(v); const l = s.lessons.find(x => x.id === v); if (l) setDate(l.date); }} options={[{ value: '', label: '不关联' }, ...lessonOptions.map(l => ({ value: l.id, label: `${l.date} · ${l.hours} 小时` }))]} /></FormField>
        <FormField label="到课情况"><input maxLength={200} value={attendance} onChange={e => setAttendance(e.target.value)} placeholder="例如：6/6 全勤；李同学请假" /></FormField>
      </div>
      <FormField label="本次课程内容"><textarea required rows={3} maxLength={4000} value={content} onChange={e => setContent(e.target.value)} placeholder="本节课讲了什么、完成了哪些任务" /></FormField>
      <FormField label="学生表现"><textarea rows={3} maxLength={4000} value={performance} onChange={e => setPerformance(e.target.value)} placeholder="课堂参与、作业完成、个别同学情况" /></FormField>
      <div className="form-columns">
        <FormField label="问题与风险"><textarea rows={3} maxLength={4000} value={issues} onChange={e => setIssues(e.target.value)} placeholder="需要协调或关注的问题" /></FormField>
        <FormField label="下一步安排"><textarea rows={3} maxLength={2000} value={nextSteps} onChange={e => setNextSteps(e.target.value)} placeholder="下次课前要完成的事项" /></FormField>
      </div>
      {all && <FormField label="教务老师"><Picker label="教务老师" value={ops} onChange={setOps} options={s.staff.filter(u => u.active || u.email === ops).map(u => ({ value: u.email, label: u.name }))} /></FormField>}
      <div className="actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" type="submit">{record ? '保存修改' : '保存反馈'}</button></div>
    </form>}
  </DialogContent></Dialog>;
}

export function LessonFeedbackPage() {
  const { s, all, month, matches, toolbar, course } = useOpsFilters();
  const params = new URLSearchParams(s.route.split('?')[1]);
  const [editing, setEditing] = useState<LessonFeedback | null>(null);
  const [open, setOpen] = useState(params.has('new'));
  const [lessonId] = useState(params.get('lesson'));
  const me = s.user?.email || '';
  const rows = useMemo(() => visibleLessons(s.lessonFeedbacks, s.role, me).filter(matches).sort((a, b) => b.date.localeCompare(a.date)), [s.lessonFeedbacks, s.role, me, matches]);
  const remove = async (f: LessonFeedback) => { if (!confirmDelete('课情反馈')) return; if (await s.removeRecord('lessonFeedbacks', f.id)) toast.success('已删除'); };
  const close = () => { setOpen(false); setEditing(null); if (s.route.includes('new')) s.go('lesson-feedback'); };
  return <>
    <PageTitle title="课情反馈" en="LESSON FEEDBACK" description={all ? '全部教务老师的课情反馈，按月份、项目与老师筛选。' : '每节课后记录到课、内容与学生表现，方便跟进与复盘。'} action="记录反馈" onAction={() => { setEditing(null); setOpen(true); }} />
    <section className="glass panel">
      {toolbar}
      {!s.opsCourses.length ? <NoCourses /> : <>
        <div className="results-meta">{rows.length} 条反馈<span>{month ? monthLabel(month) : '全部月份'} · {all ? '全部老师' : '仅显示你的反馈'}</span></div>
        {rows.length ? <div className="lesson-feedback-list">{rows.map(f => { const c = course(f.course); const l = f.lesson ? s.lessons.find(x => x.id === f.lesson) : undefined; return <article key={f.id} className="lesson-feedback-card">
          <header><div><strong>{c?.name || '已删除的课程'}</strong><small>{c?.code} · {f.date} · {s.staffName(f.opsTeacher)}</small></div>
            <div className="lf-tags">{f.attendance && <Badge tone="neutral">{f.attendance}</Badge>}{l && <Badge tone="violet"><Link2 size={11} />课时 {l.hours} 小时</Badge>}</div>
            <div className="row-actions"><button className="icon-button" aria-label="编辑" title="编辑" onClick={() => { setEditing(f); setOpen(true); }}><Pencil size={15} /></button><button className="icon-button" aria-label="删除" title="删除" onClick={() => remove(f)}><Trash2 size={15} /></button></div>
          </header>
          <dl>{([['本次内容', f.content], ['学生表现', f.performance], ['问题与风险', f.issues], ['下一步', f.nextSteps]] as const).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </article>; })}</div>
          : <EmptyState icon={MessageSquareText} title={month ? `${monthLabel(month)}还没有课情反馈` : '还没有课情反馈'} description="课后花一分钟记录到课、内容与表现，也可以从课时记录一键生成。" action="记录反馈" onAction={() => { setEditing(null); setOpen(true); }} />}
      </>}
    </section>
    {open && <FeedbackDialog key={editing?.id || 'new'} record={editing} lessonId={editing ? null : lessonId} open={open} onClose={close} />}
  </>;
}

/** 当月教务津贴 for the signed-in teacher (dashboard KPI). */
export function useMonthAllowance() {
  const s = useNexus();
  const month = currentMonth();
  return { month, ...monthAllowance(s.lessons, s.user?.email || '', month) };
}
