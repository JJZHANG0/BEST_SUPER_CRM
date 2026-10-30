'use client';
/** 课时记录 (lesson hours + 教务津贴) and 课情反馈 (lesson feedback) for ops teachers. */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Clock, Copy, Download, Pencil, Trash2, MessageSquareText, BookOpenCheck, Link2, CalendarDays, Users, GraduationCap, Lock, LockOpen, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { TeacherPicker } from './teacher-picker';
import { CourseCombobox } from './course-combobox';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import { copyText } from '@/lib/nexus/clipboard';
import { useNexus } from '@/lib/nexus/store';
import { canSeeAllLessons, canManageSystem, isTeacher, type Viewer } from '@/lib/nexus/roles';
import {
  computeAllowance, currentMonth, today, monthOf, monthLabel, money2, unitLabel, needsStudents, summarizeByTeacher,
  visibleLessons, monthAllowance, toCsv, newRecordId, lessonTeacher, hoursByLessonTeacher, lessonWithFeedback, expectedAttendance, attendanceText,
  isLessonMonthLocked, canEditLockedLessonMonth, myLessonTeachingFee, myTeachingLessonHours,
  lessonFeedbackRequested, parentFeedbackText,
  type LessonRecord, type LessonFeedback, type OpsCourse, type FeedbackDraft,
  opsOwnScope,
} from '@/lib/nexus/ops';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge, PageTitle, SearchBox, FormField, Picker, EmptyState } from './ui';
import { ZoomModal } from './zoom-modal';

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
  const all = canSeeAllLessons(s.viewer);
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
    const hay = ((c?.code || '') + (c?.name || '') + (c?.teacher || '') + ((r as { teacher?: string }).teacher || '')).toLowerCase();
    return !q.trim() || hay.includes(q.trim().toLowerCase());
  };
  const toolbar = (
    <div className="filter-toolbar ops-filters">
      <SearchBox value={q} onChange={setQ} placeholder="搜索课程编号、名称或授课老师" />
      <label className="month-field"><CalendarDays size={15} /><input type="month" aria-label="月份" value={month} onChange={e => setMonth(e.target.value)} /></label>
      <Picker label="项目" value={project} onChange={setProject} options={[{ value: ALL, label: '全部项目' }, ...s.projects.map(p => ({ value: p.id, label: p.code + ' ' + (p.name !== p.code ? p.name : '') }))]} />
    </div>
  );
  return { s, all, month, matches, toolbar, course, teacher, setTeacher };
}

/** Courses the signed-in user may log against: own + unassigned (superadmin: all). */
function loggableCourses(courses: OpsCourse[], viewer: Viewer, email: string, teacherName = '', keep = '') {
  if (isTeacher(viewer.role)) {
    const n = teacherName.trim();
    return n ? courses.filter(c => c.teacher === n || c.teacher.includes(n)) : courses;
  }
  // 运营端（含部门负责人）: only courses where I am the 授课老师 or the 运营老师; keep the edited record's course.
  const own = opsOwnScope({ name: teacherName, email }, courses, []).opsCourseIds;
  return courses.filter(c => own.has(c.id) || c.id === keep);
}
const courseLabel = (c: OpsCourse) => `${c.code} · ${c.name}`;
/** 「5/6」 (实到/应到), 「5」 or 「—」 for the table. */
const headcount = (r: LessonRecord) => r.actualCount == null ? (r.expectedCount != null ? `—/${r.expectedCount}` : '—') : r.expectedCount != null ? `${r.actualCount}/${r.expectedCount}` : String(r.actualCount);

function NoCourses() {
  const s = useNexus();
  return canManageSystem(s.role)
    ? <EmptyState icon={BookOpenCheck} title="还没有课程" description="先在系统管理中添加项目与课程（支持按表格列 CSV 批量导入），即可开始记录课时。" action="去添加课程" onAction={() => s.go('admin?tab=courses')} />
    : <EmptyState icon={BookOpenCheck} title="还没有分配给你的课程" description="课程由超级管理员在系统管理中创建并指定教务老师，创建后即可在这里记录课时。" />;
}

function LessonDialog({ record, open, onClose }: { record: LessonRecord | null; open: boolean; onClose: () => void }) {
  const s = useNexus();
  const me = s.user?.email || '';
  const all = canSeeAllLessons(s.viewer);
  const options = loggableCourses(s.opsCourses, s.viewer, me, s.user?.name || '', record?.course || '');
  const linked = record ? s.lessonFeedbacks.find(f => f.lesson === record.id) ?? null : null;
  const [courseId, setCourseId] = useState(record?.course || options[0]?.id || '');
  const [date, setDate] = useState(record?.date || today());
  const [hours, setHours] = useState(String(record?.hours ?? 2));
  const [actual, setActual] = useState(record?.actualCount != null ? String(record.actualCount) : '');
  const [ops, setOps] = useState(record?.opsTeacher || options[0]?.opsTeacher || me);
  const [teacher, setTeacher] = useState(record ? lessonTeacher(record, s.opsCourses).replace(/^未填写$/, '') : options[0]?.teacher || '');
  const [note, setNote] = useState(record?.note || '');
  const [replay, setReplay] = useState(record?.replayUrl || '');
  const formRef = useRef<HTMLFormElement>(null);
  // 学情反馈 captured in the same form (creates / updates the linked 课情反馈).
  const [withFb, setWithFb] = useState(!record || !!linked);
  // 到课情况 follows 实到/应到 (「5/6 到课」) until the user types their own text.
  const [attTouched, setAttTouched] = useState(!!linked?.attendance);
  const [fb, setFb] = useState<FeedbackDraft>({ attendance: linked?.attendance || '', content: linked?.content || '', performance: linked?.performance || '', issues: linked?.issues || '', nextSteps: linked?.nextSteps || '' });
  const setF = (k: keyof FeedbackDraft) => (e: { target: { value: string } }) => setFb(v => ({ ...v, [k]: e.target.value }));
  const course = s.opsCourses.find(c => c.id === courseId);
  const fresh = !record || record.course !== courseId;
  const type = s.classTypes.find(t => t.id === course?.classType);
  const rate = fresh ? type?.rate ?? 0 : record!.rate, unit = fresh ? type?.unit ?? 'hour' : record!.unit;
  const roster = useMemo(() => ({ courses: s.courses, teams: s.teams, enrollments: s.enrollments, students: s.students, classTypes: s.classTypes }), [s.courses, s.teams, s.enrollments, s.students, s.classTypes]);
  const exp = useMemo(() => expectedAttendance(course, roster), [course, roster]);
  // Editing on the same course keeps the 应到人数 saved with the record; a new / moved record uses the roster now.
  const keepSaved = !!record && record.course === courseId && record.expectedCount != null;
  const expected = keepSaved ? record!.expectedCount : exp.count;
  const expectedHint = keepSaved ? '记录时的应到人数' : exp.hint;
  const h = Number(hours), n = actual === '' ? null : Number(actual);
  const amount = computeAllowance(rate, unit, h, n);
  const autoAtt = attendanceText(n, expected);
  const attendance = attTouched ? fb.attendance : autoAtt;
  const projectLabel = useCallback((id: string) => { const p = s.projects.find(x => x.id === id); return p ? (p.name && p.name !== p.code ? `${p.code} ${p.name}` : p.code) : ''; }, [s.projects]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!course || !type) return toast.error('请选择课程');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast.error('请选择上课日期');
    if (!(h > 0 && h <= 24)) return toast.error('课时需在 0–24 小时之间');
    if (n != null && !(Number.isInteger(n) && n >= 0 && n <= 1000)) return toast.error('实到人数需为 0–1000 的整数');
    if (needsStudents(unit) && !(n && n > 0)) return toast.error('该班型按人数计算津贴，请填写实到人数');
    const ownerEmail = (record?.opsTeacher || me).toLowerCase();
    if (!canEditLockedLessonMonth(s.user) && (isLessonMonthLocked(s.lessonMonthLocks, date, ownerEmail) || (record && isLessonMonthLocked(s.lessonMonthLocks, record.date, record.opsTeacher)))) {
      return toast.error('你在该月的课时已确认锁定，仅张捷嘉可修改');
    }
    const owner = all ? (ops || me) : me;
    const rec: LessonRecord = { id: record?.id || newRecordId('L'), course: course.id, date, hours: h, expectedCount: expected ?? null, actualCount: n, opsTeacher: owner.toLowerCase(), rate, unit, amount, note: note.trim(), createdBy: record?.createdBy || me, teacher: teacher.trim(), replayUrl: replay.trim() };
    // Auto 到课情况 (from 实到/应到) must not count as written feedback, or the save is blocked until 本次课程内容 is filled.
    const r = lessonWithFeedback({ lesson: rec, feedback: { ...fb, attendance }, withFeedback: lessonFeedbackRequested(withFb, fb, attTouched), existing: linked, newId: () => newRecordId('LF') });
    if (r.issue) return toast.error(r.issue);
    s.setLessons(l => record ? l.map(x => x.id === rec.id ? rec : x) : [rec, ...l]);
    if (r.feedback) { const f = r.feedback; s.setLessonFeedbacks(l => l.some(x => x.id === f.id) ? l.map(x => x.id === f.id ? f : x) : [f, ...l]); }
    s.log((record ? '修改课时记录：' : '记录课时：') + course.code + ' ' + date + (r.feedback ? '（含学情反馈）' : ''));
    toast.success(record ? '课时记录已更新' : `已记录课时，津贴 ${money2(amount)}${r.feedback ? '，学情反馈已同步到课情反馈' : ''}`);
    onClose();
  };
  const copyFeedback = async () => {
    const text = parentFeedbackText({
      courseName: course?.name, courseCode: course?.code, date, teacher, hours: Number.isFinite(h) ? h : null,
      attendance, expectedCount: expected, actualCount: n, content: fb.content, performance: fb.performance,
      issues: fb.issues, nextSteps: fb.nextSteps, note, replayUrl: replay,
    });
    if (await copyText(text, formRef.current)) toast.success('课程反馈已复制，可直接粘贴到家长群');
    else toast.error('浏览器限制了复制，请手动选择文字');
  };
  return <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog wide lesson-dialog">
    <DialogTitle>{record ? '编辑课时记录' : '记录课时'}</DialogTitle>
    <DialogDescription>津贴按课程的班级类型自动计算，记录时锁定当时的津贴标准；下方的学情反馈会自动生成关联的课情反馈。</DialogDescription>
    {!options.length ? <NoCourses /> : <form ref={formRef} className="form-stack" noValidate onSubmit={submit}>
      {/* Editing an existing 课时记录 (incl. 「已有学情反馈」) keeps the row's course locked — no re-select. */}
      <div className="form-field"><span>课程</span>{record && course
        ? <div className="course-locked" aria-label="已绑定课程"><strong>{courseLabel(course)}</strong><small>{projectLabel(course.project)}{course.teacher ? ' · ' + course.teacher : ''}</small></div>
        : <CourseCombobox courses={options} value={courseId} projectLabel={projectLabel} onChange={v => { setCourseId(v); const c = s.opsCourses.find(x => x.id === v); if (c?.opsTeacher && all) setOps(c.opsTeacher); if (c) setTeacher(c.teacher || ''); }} />}</div>
      <div className="form-columns four">
        <FormField label="上课日期"><input type="date" required value={date} onChange={e => setDate(e.target.value)} /></FormField>
        <FormField label="课时（小时）"><input type="number" required min="0.25" max="24" step="0.25" value={hours} onChange={e => setHours(e.target.value)} /></FormField>
        <div className="form-field expected-field"><span>应到人数</span><output className={'expected-count' + (expected == null ? ' unknown' : '')} aria-label="应到人数" title={expectedHint}>{expected ?? '—'}<small>{expected == null ? '' : ' 人'}</small></output><small className="field-hint">{expectedHint}</small></div>
        <FormField label={needsStudents(unit) ? '实到人数（按人计费，必填）' : '实到人数'}><input type="number" min="0" max="1000" step="1" inputMode="numeric" value={actual} required={needsStudents(unit)} onChange={e => setActual(e.target.value)} placeholder={expected != null ? `例如 ${expected}` : '例如 6'} aria-label="实到人数" /></FormField>
      </div>
      <div className="form-columns">
        <FormField label="授课老师（默认取课程的授课老师）"><TeacherPicker value={teacher} onChange={setTeacher} /></FormField>
        <FormField label="教务老师">{all ? <Picker label="教务老师" value={ops} onChange={setOps} options={s.staff.filter(u => u.active || u.email === ops).map(u => ({ value: u.email, label: u.name }))} /> : <input value={s.staffName(me)} disabled />}</FormField>
      </div>
      <FormField label="备注（可选）"><input maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="例如：补课、调课说明" /></FormField>
      <FormField label="课程回放链接（可选）"><input maxLength={2000} inputMode="url" value={replay} onChange={e => setReplay(e.target.value)} placeholder="https:// 粘贴会议或录播链接，会一起复制到家长群" aria-label="课程回放链接" /></FormField>
      <div className="allowance-preview" aria-live="polite">
        <span>{type ? `${type.name} · ¥${rate} ${unitLabel(unit)}` : '未选择课程'}</span>
        <span>{unit === 'person_hour' ? `¥${rate} × ${n || 0} 人 × ${h || 0} 小时` : unit === 'session' ? `¥${rate} × 1 次` : `¥${rate} × ${h || 0} 小时`}</span>
        <b>{money2(amount)}</b>
      </div>
      <fieldset className={'lesson-fb' + (withFb ? '' : ' off')}>
        <legend><label className="checkbox-label"><Checkbox checked={withFb} onCheckedChange={v => setWithFb(v === true)} /><span><MessageSquareText size={15} />同时记录学情反馈{linked ? '（已关联，保存时一并更新）' : '（自动生成课情反馈）'}</span></label></legend>
        {withFb && <>
          <FormField label={attTouched ? '到课情况' : '到课情况（按实到/应到自动填写，可修改）'}><input maxLength={200} value={attendance} onChange={e => { const v = e.target.value; setAttTouched(v !== ''); setFb(x => ({ ...x, attendance: v })); }} placeholder="填写实到人数后自动生成，例如：5/6 到课；李同学请假" /></FormField>
          <FormField label="本次课程内容"><textarea rows={6} maxLength={4000} value={fb.content} onChange={setF('content')} placeholder="本节课讲了什么、完成了哪些任务" className="fb-tall" /></FormField>
          <FormField label="学生布置"><textarea rows={6} maxLength={4000} value={fb.performance} onChange={setF('performance')} placeholder="课堂参与、作业完成、个别同学情况" className="fb-tall" /></FormField>
          <div className="form-columns">
            <FormField label="问题与风险"><textarea rows={2} maxLength={4000} value={fb.issues} onChange={setF('issues')} placeholder="需要协调或关注的问题" /></FormField>
            <FormField label="下一步安排"><textarea rows={2} maxLength={2000} value={fb.nextSteps} onChange={setF('nextSteps')} placeholder="下次课前要完成的事项" /></FormField>
          </div>
        </>}
      </fieldset>
      <div className="actions lesson-actions"><button type="button" className="secondary copy-feedback" onClick={copyFeedback}><Copy size={16} />复制课程反馈</button><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" type="submit">{record ? '保存修改' : withFb && fb.content.trim() ? '保存课时与反馈' : '保存课时'}</button></div>
    </form>}
  </DialogContent></Dialog>;
}

/** Per-person tabs for the 部门负责人: 全部 + every ops teacher (with their counts for the month). */
function PersonTabs({ value, onChange, counts }: { value: string; onChange: (v: string) => void; counts: Map<string, number> }) {
  const s = useNexus();
  const people = s.staff.filter(u => (u.active && !u.leader) || counts.get(u.email.toLowerCase()));
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return <div className="admin-tabs person-tabs" role="tablist" aria-label="按老师查看">
    <button role="tab" aria-selected={value === ALL} className={value === ALL ? 'selected' : ''} onClick={() => onChange(ALL)}><Users size={15} />全部老师<em>{total}</em></button>
    {people.map(u => <button key={u.email} role="tab" aria-selected={value === u.email} className={value === u.email ? 'selected' : ''} onClick={() => onChange(u.email)}><span className="avatar tiny-avatar" aria-hidden="true">{u.name.slice(0, 1)}</span>{u.name}<em>{counts.get(u.email.toLowerCase()) || 0}</em></button>)}
  </div>;
}

/** Hold 3s to confirm the signed-in teacher's own lessons for the month. Does not lock anyone else. */
function MonthConfirmHold({ month, locked, opsTeacher, own }: { month: string; locked: boolean; opsTeacher: string; own: boolean }) {
  const s = useNexus();
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const holding = useRef(false);
  const raf = useRef(0);
  const started = useRef(0);
  const HOLD_MS = 3000;
  const clear = useCallback(() => {
    holding.current = false;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
    setProgress(0);
  }, []);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);
  const finish = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    clear();
    const r = await s.confirmLessonMonth(month);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(r.already ? `${monthLabel(month)}你的课时已经锁定` : `${monthLabel(month)}已锁定你自己的课时，其他老师不受影响`);
  }, [busy, clear, month, s]);
  const tick = useCallback((now: number) => {
    if (!holding.current) return;
    const p = Math.min(1, (now - started.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) { holding.current = false; void finish(); return; }
    raf.current = requestAnimationFrame(tick);
  }, [finish]);
  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (locked || busy || !month) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    holding.current = true;
    started.current = performance.now();
    setProgress(0);
    raf.current = requestAnimationFrame(tick);
  };
  const onUp = () => { if (progress < 1) clear(); };
  const canUnlock = canEditLockedLessonMonth(s.user);
  const unlock = async () => {
    if (busy || !month || !opsTeacher) return;
    const whoName = s.staffName(opsTeacher);
    if (!window.confirm(`驳回${whoName}在${monthLabel(month)}的课时确认？只解开 TA 自己的记录。`)) return;
    setBusy(true);
    const r = await s.unlockLessonMonth(month, opsTeacher);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(r.already ? `${whoName}在${monthLabel(month)}本来就没有锁定` : `已驳回${whoName}在${monthLabel(month)}的锁定`);
  };
  if (!month || !opsTeacher) return null;
  if (locked) {
    return <span className="month-lock-actions">
      <span className="month-lock-badge" title={own ? '你在本月的课时已锁定，仅张捷嘉可驳回' : '这位老师本月的课时已锁定'}><Lock size={13} />已确认锁定</span>
      {canUnlock && <button type="button" className="month-unlock" disabled={busy} onClick={() => void unlock()}><LockOpen size={13} />{busy ? '解锁中…' : '驳回解锁'}</button>}
    </span>;
  }
  if (!own) return <span className="month-lock-scope">尚未锁定</span>;
  return <button type="button" className={'month-confirm-hold' + (busy ? ' busy' : '')} disabled={busy}
    aria-label="长按三秒确认本月授课老师课时"
    title="长按 3 秒确认。只锁定你自己的课时，其他运营老师不受影响"
    onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={clear} onPointerLeave={onUp}
    onContextMenu={e => e.preventDefault()}>
    <i style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
    <CheckCircle2 size={14} />
    <span>{busy ? '确认中…' : progress > 0 ? `按住确认 ${Math.ceil((1 - progress) * 3)}s` : '长按 3 秒确认'}</span>
  </button>;
}

/** 授课老师 hours for the selected month (within the records this viewer may see). */
function TeacherHours({ rows, month, lockSubject, own }: { rows: LessonRecord[]; month: string; lockSubject: string; own: boolean }) {
  const s = useNexus();
  const list = hoursByLessonTeacher(rows, s.opsCourses, month);
  const locked = !!month && !!lockSubject && isLessonMonthLocked(s.lessonMonthLocks, month, lockSubject);
  const lockControl = !!month && !!lockSubject
    ? <MonthConfirmHold month={month} locked={locked} opsTeacher={lockSubject} own={own} />
    : (month && s.lessonMonthLocks.some(l => l.month === month) ? <span className="month-lock-scope">按老师分别锁定。要驳回，先点开那位老师。</span> : null);
  if (!list.length && !month) return null;
  if (!list.length) {
    return month ? <div className="teacher-hours" aria-label="授课老师课时">
      <div className="teacher-hours-head"><GraduationCap size={15} /><strong>{monthLabel(month)} · 授课老师课时</strong>
        {lockControl}</div>
      <p className="teacher-hours-empty">本月还没有授课老师课时可确认。</p>
    </div> : null;
  }
  const max = Math.max(...list.map(x => x.hours));
  return <div className="teacher-hours" aria-label="授课老师课时">
    <div className="teacher-hours-head"><GraduationCap size={15} /><strong>{month ? monthLabel(month) : '全部月份'} · 授课老师课时</strong>
      <small>{list.length} 位老师 · 共 {Math.round(list.reduce((n, x) => n + x.hours, 0) * 100) / 100} 小时</small>
      {lockControl}
    </div>
    <div className="teacher-hours-list">{list.map(t => <div key={t.teacher} className="teacher-hour-chip" title={`${t.teacher}：${t.count} 节 · ${t.hours} 小时`}>
      <span className="th-name">{t.teacher}</span><b>{t.hours}<small> 小时</small></b><small className="th-count">{t.count} 节</small>
      <i style={{ width: `${Math.max(6, (t.hours / max) * 100)}%` }} aria-hidden="true" />
    </div>)}</div>
  </div>;
}

export function LessonsPage() {
  const { s, all, month, matches, toolbar, course, teacher, setTeacher } = useOpsFilters();
  const [editing, setEditing] = useState<LessonRecord | null>(null);
  const [open, setOpen] = useState(new URLSearchParams(s.route.split('?')[1]).has('new'));
  const me = s.user?.email || '';
  const visible = useMemo(() => visibleLessons(s.lessons, s.viewer, me), [s.lessons, s.viewer, me]);
  // Leader tabs count the month's records per 教务老师 (before the person filter).
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const r of visible) if (!month || monthOf(r.date) === month) m.set(r.opsTeacher.toLowerCase(), (m.get(r.opsTeacher.toLowerCase()) || 0) + 1); return m; }, [visible, month]);
  const rows = useMemo(() => visible.filter(matches).sort((a, b) => b.date.localeCompare(a.date)), [visible, matches]);
  const total = rows.reduce((n, r) => n + r.amount, 0), hours = rows.reduce((n, r) => n + r.hours, 0);
  const summary = summarizeByTeacher(rows);
  const typeName = (c?: OpsCourse) => s.classTypes.find(t => t.id === c?.classType)?.name || '—';
  const person = all && teacher !== ALL ? s.staffName(teacher) : '';
  // 「我的课时费用」: only when 授课老师 === logged-in ops teacher (本人授课) × ¥150; 跟课-only → ¥0.
  const myHours = useMemo(
    () => myTeachingLessonHours(visible, s.opsCourses, s.user?.name || '', month),
    [visible, month, s.opsCourses, s.user?.name],
  );
  const myFee = myLessonTeachingFee(myHours);
  const canBypassLock = canEditLockedLessonMonth(s.user);
  const meEmail = me.toLowerCase();
  const lockSubject = all && teacher !== ALL ? teacher.toLowerCase() : (all ? '' : meEmail);
  const lockOwn = !!lockSubject && lockSubject === meEmail;
  const exportCsv = () => {
    const head = ['日期', '项目编号', '课程编号', '课程名称', '班级类型', '课时(小时)', '应到人数', '实到人数', '津贴标准', '津贴(元)', '授课老师', '教务老师', '备注', '课程回放链接'];
    download(`课时记录-${person ? person + '-' : ''}${month || '全部'}.csv`, toCsv([head, ...rows.map(r => { const c = course(r.course); return [r.date, s.projects.find(p => p.id === c?.project)?.code || '', c?.code || '', c?.name || '', typeName(c), r.hours, r.expectedCount ?? '', r.actualCount ?? '', `${r.rate}${unitLabel(r.unit)}`, r.amount, lessonTeacher(r, s.opsCourses), s.staffName(r.opsTeacher), r.note, r.replayUrl || '']; })]));
  };
  const copyRow = async (r: LessonRecord, el: HTMLElement) => {
    const c = course(r.course);
    const f = s.lessonFeedbacks.find(x => x.lesson === r.id);
    const text = parentFeedbackText({
      courseName: c?.name, courseCode: c?.code, date: r.date, teacher: lessonTeacher(r, s.opsCourses), hours: r.hours,
      attendance: f?.attendance, expectedCount: r.expectedCount, actualCount: r.actualCount,
      content: f?.content, performance: f?.performance, issues: f?.issues, nextSteps: f?.nextSteps, note: r.note, replayUrl: r.replayUrl,
    });
    if (await copyText(text, el)) toast.success('课程反馈已复制，可直接粘贴到家长群');
    else toast.error('浏览器限制了复制，请手动选择文字');
  };
  const remove = async (r: LessonRecord) => {
    if (!canBypassLock && isLessonMonthLocked(s.lessonMonthLocks, r.date, r.opsTeacher)) return toast.error('你在该月的课时已确认锁定，仅张捷嘉可修改');
    if (!confirmDelete('课时记录')) return;
    if (await s.removeRecord('lessons', r.id)) { s.setLessonFeedbacks(l => l.map(f => f.lesson === r.id ? { ...f, lesson: null } : f)); toast.success('已删除'); }
  };
  const hasFb = (r: LessonRecord) => s.lessonFeedbacks.some(f => f.lesson === r.id);
  const rowEditable = (r: LessonRecord) => canBypassLock || !isLessonMonthLocked(s.lessonMonthLocks, r.date, r.opsTeacher);
  return <>
    <PageTitle title="课时记录" en="LESSON HOURS" description={all ? '部门负责人：按老师分开查看每个人的课时与当月教务津贴，可按月份、项目筛选。' : '记录你负责课程的课时与学情反馈，津贴按班级类型自动计算；只有你和部门负责人能看到你的记录。'} action="记录课时" onAction={() => { setEditing(null); setOpen(true); }} />
    {all && <PersonTabs value={teacher} onChange={setTeacher} counts={counts} />}
    <div className="mini-stats ops-stats">
      <div className="glass"><span>{month ? monthLabel(month) : '全部月份'} · {person ? person + ' · ' : all ? '全部老师 · ' : '我的'}津贴合计</span><b>{money2(total)}</b></div>
      <div className="glass"><span>跟课合计</span><b>{Math.round(hours * 100) / 100}<small> 小时</small></b></div>
      <div className="glass"><span>记录条数</span><b>{rows.length}<small> 条</small></b></div>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="glass fee-stat" tabIndex={0} aria-label="我的课时费用">
              <span>我的课时费用</span><b>{money2(myFee)}</b>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="fee-tip">快去找领导加课吧～</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
    <section className="glass panel">
      {toolbar}
      {!s.opsCourses.length ? <NoCourses /> : <>
        <TeacherHours rows={rows} month={month} lockSubject={lockSubject} own={lockOwn} />
        {all && teacher === ALL && summary.length > 0 && <div className="teacher-summary">{summary.map(t => <button type="button" key={t.opsTeacher} onClick={() => setTeacher(s.staff.find(u => u.email.toLowerCase() === t.opsTeacher.toLowerCase())?.email || t.opsTeacher)} title={'只看 ' + s.staffName(t.opsTeacher)}><span className="avatar small-avatar">{s.staffName(t.opsTeacher).slice(0, 1)}</span><div><strong>{s.staffName(t.opsTeacher)}</strong><small>{t.count} 条 · {t.hours} 小时</small></div><b>{money2(t.amount)}</b></button>)}</div>}
        <div className="results-meta">{rows.length} 条记录<span>{all ? (person ? `仅 ${person} 的记录` : '部门负责人可查看全部老师') : '仅显示你的记录'}{rows.length > 0 && <button className="text-button inline-action" onClick={exportCsv}><Download size={14} />导出 CSV</button>}</span></div>
        {rows.length ? <>
          <div className="ops-table-wrap desktop-only-table"><Table className="ops-table"><TableHeader><TableRow>{['日期', '课程', '班级类型', '课时', '实到/应到', '津贴标准', '津贴', '授课老师', '教务老师', ''].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.map(r => { const c = course(r.course); const editable = rowEditable(r); return <TableRow key={r.id} className={editable ? undefined : 'is-locked-month'}>
            <TableCell className="nowrap">{r.date}</TableCell>
            <TableCell className="course-cell"><div className="course-stack"><strong className="cell-title">{c?.name || '已删除的课程'}</strong>{c?.code ? <small className="cell-sub">{c.code}</small> : null}</div></TableCell>
            <TableCell>{typeName(c)}</TableCell>
            <TableCell className="num">{r.hours}</TableCell>
            <TableCell className="num nowrap" title={r.expectedCount != null ? `实到 ${r.actualCount ?? '—'} / 应到 ${r.expectedCount}` : undefined}>{headcount(r)}</TableCell>
            <TableCell className="nowrap">¥{r.rate} {unitLabel(r.unit)}</TableCell>
            <TableCell className="num"><b>{money2(r.amount)}</b></TableCell>
            <TableCell className="nowrap">{lessonTeacher(r, s.opsCourses)}</TableCell>
            <TableCell className="nowrap">{s.staffName(r.opsTeacher)}</TableCell>
            <TableCell className="row-actions">
              <button type="button" className="icon-button" aria-label="复制课程反馈" title="复制课程反馈" onClick={e => copyRow(r, e.currentTarget)}><Copy size={15} /></button>
              <button className={'icon-button' + (hasFb(r) ? ' has-feedback' : '')} aria-label={hasFb(r) ? '已有学情反馈，点击编辑' : '写课情反馈'} title={hasFb(r) ? '已有学情反馈' : '写课情反馈'} onClick={() => hasFb(r) ? (editable ? (setEditing(r), setOpen(true)) : toast.error('你在该月的课时已确认锁定，仅张捷嘉可修改')) : s.go('lesson-feedback?new&lesson=' + r.id)}><MessageSquareText size={15} /></button>
              {editable
                ? <><button className="icon-button" aria-label="编辑" title="编辑" onClick={() => { setEditing(r); setOpen(true); }}><Pencil size={15} /></button>
                  <button className="icon-button" aria-label="删除" title="删除" onClick={() => remove(r)}><Trash2 size={15} /></button></>
                : <span className="row-lock-hint" title="你在该月的课时已锁定，仅张捷嘉可驳回"><Lock size={14} /></span>}
            </TableCell>
          </TableRow>; })}</TableBody></Table></div>
          <ul className="ops-mobile-cards">{rows.map(r => { const c = course(r.course); const editable = rowEditable(r); return <li key={r.id} className={'ops-mobile-card' + (editable ? '' : ' is-locked-month')}>
            <div className="ops-mobile-card-top"><time dateTime={r.date}>{r.date}</time><b className="ops-mobile-amount">{money2(r.amount)}</b></div>
            <strong className="ops-mobile-course" title={c?.name}>{c?.name || '已删除的课程'}</strong>
            {c?.code ? <small className="ops-mobile-code">{c.code}</small> : null}
            <div className="ops-mobile-meta"><span>{r.hours} 课时</span><span>{headcount(r)}</span><span>{lessonTeacher(r, s.opsCourses)}</span></div>
            <div className="ops-mobile-actions">
              <button type="button" className="icon-button" aria-label="复制课程反馈" onClick={e => copyRow(r, e.currentTarget)}><Copy size={18} /></button>
              <button type="button" className={'icon-button' + (hasFb(r) ? ' has-feedback' : '')} aria-label={hasFb(r) ? '已有学情反馈，点击编辑' : '写课情反馈'} onClick={() => hasFb(r) ? (editable ? (setEditing(r), setOpen(true)) : toast.error('你在该月的课时已确认锁定，仅张捷嘉可修改')) : s.go('lesson-feedback?new&lesson=' + r.id)}><MessageSquareText size={18} /></button>
              {editable
                ? <><button type="button" className="icon-button" aria-label="编辑" onClick={() => { setEditing(r); setOpen(true); }}><Pencil size={18} /></button>
                  <button type="button" className="icon-button" aria-label="删除" onClick={() => remove(r)}><Trash2 size={18} /></button></>
                : <span className="row-lock-hint" title="你在该月的课时已锁定，仅张捷嘉可驳回"><Lock size={16} /></span>}
            </div>
          </li>; })}</ul>
        </>
          : <EmptyState icon={Clock} title={month ? `${monthLabel(month)}${person ? ' · ' + person : ''}还没有课时记录` : '还没有课时记录'} description="每上完一节课记录一次（可同时填写学情反馈），月底即可直接核对教务津贴。" action="记录课时" onAction={() => { setEditing(null); setOpen(true); }} />}
      </>}
    </section>
    {open && <LessonDialog key={editing?.id || 'new'} record={editing} open={open} onClose={() => { setOpen(false); setEditing(null); if (s.route.includes('new')) s.go('lessons'); }} />}
  </>;
}

function FeedbackDialog({ record, lessonId, open, onClose }: { record: LessonFeedback | null; lessonId?: string | null; open: boolean; onClose: () => void }) {
  const s = useNexus();
  const me = s.user?.email || '';
  const all = canSeeAllLessons(s.viewer);
  const fromLesson = lessonId ? s.lessons.find(l => l.id === lessonId) : undefined;
  const options = loggableCourses(s.opsCourses, s.viewer, me, s.user?.name || '', record?.course || fromLesson?.course || '');
  const [courseId, setCourseId] = useState(record?.course || fromLesson?.course || options[0]?.id || '');
  const [date, setDate] = useState(record?.date || fromLesson?.date || today());
  const [lesson, setLesson] = useState(record?.lesson || fromLesson?.id || '');
  const [attendance, setAttendance] = useState(record?.attendance || (fromLesson ? attendanceText(fromLesson.actualCount, fromLesson.expectedCount) : ''));
  const [content, setContent] = useState(record?.content || '');
  const [performance, setPerformance] = useState(record?.performance || '');
  const [issues, setIssues] = useState(record?.issues || '');
  const [nextSteps, setNextSteps] = useState(record?.nextSteps || '');
  const [ops, setOps] = useState(record?.opsTeacher || fromLesson?.opsTeacher || me);
  const lessonOptions = visibleLessons(s.lessons, s.viewer, me).filter(l => l.course === courseId).sort((a, b) => b.date.localeCompare(a.date));
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
        <div className="form-field"><span>课程</span>{(record || fromLesson) && options.find(c => c.id === courseId)
          ? <div className="course-locked" aria-label="已绑定课程"><strong>{courseLabel(options.find(c => c.id === courseId)!)}</strong><small>已关联课时记录，课程不可更改</small></div>
          : <Picker label="课程" value={courseId} onChange={v => { setCourseId(v); setLesson(''); }} options={options.map(c => ({ value: c.id, label: courseLabel(c) }))} />}</div>
        <FormField label="上课日期"><input type="date" required value={date} onChange={e => setDate(e.target.value)} /></FormField>
      </div>
      <div className="form-columns">
        <FormField label="关联课时记录（可选）"><Picker label="关联课时记录" value={lesson} onChange={v => { setLesson(v); const l = s.lessons.find(x => x.id === v); if (l) setDate(l.date); }} options={[{ value: '', label: '不关联' }, ...lessonOptions.map(l => ({ value: l.id, label: `${l.date} · ${l.hours} 小时` }))]} /></FormField>
        <FormField label="到课情况"><input maxLength={200} value={attendance} onChange={e => setAttendance(e.target.value)} placeholder="例如：6/6 全勤；李同学请假" /></FormField>
      </div>
      <FormField label="本次课程内容"><textarea required rows={6} maxLength={4000} value={content} onChange={e => setContent(e.target.value)} placeholder="本节课讲了什么、完成了哪些任务" className="fb-tall" /></FormField>
      <FormField label="学生布置"><textarea rows={6} maxLength={4000} value={performance} onChange={e => setPerformance(e.target.value)} placeholder="课堂参与、作业完成、个别同学情况" className="fb-tall" /></FormField>
      <div className="form-columns">
        <FormField label="问题与风险"><textarea rows={3} maxLength={4000} value={issues} onChange={e => setIssues(e.target.value)} placeholder="需要协调或关注的问题" /></FormField>
        <FormField label="下一步安排"><textarea rows={3} maxLength={2000} value={nextSteps} onChange={e => setNextSteps(e.target.value)} placeholder="下次课前要完成的事项" /></FormField>
      </div>
      {all && <FormField label="教务老师"><Picker label="教务老师" value={ops} onChange={setOps} options={s.staff.filter(u => u.active || u.email === ops).map(u => ({ value: u.email, label: u.name }))} /></FormField>}
      <div className="actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" type="submit">{record ? '保存修改' : '保存反馈'}</button></div>
    </form>}
  </DialogContent></Dialog>;
}

/** 课程编号 · 日期 · 老师 on one row, then the 实到 / 课时 chips on the next (cards and the zoomed detail). */
function FeedbackMeta({ code, date, teacher, attendance, hours }: { code?: string; date: string; teacher: string; attendance?: string; hours?: number }) {
  return <div className="lf-meta">
    <p className="lf-meta-line">{code && <span className="lf-code">{code}</span>}<span>{date}</span><span>{teacher}</span></p>
    {(attendance || hours != null) && <div className="lf-tags">{attendance && <Badge tone="neutral"><Users size={11} />{attendance}</Badge>}{hours != null && <Badge tone="violet"><Link2 size={11} />课时 {hours} 小时</Badge>}</div>}
  </div>;
}

export function LessonFeedbackPage() {
  const { s, all, month, matches, toolbar, course, teacher, setTeacher } = useOpsFilters();
  const params = new URLSearchParams(s.route.split('?')[1]);
  const [editing, setEditing] = useState<LessonFeedback | null>(null);
  const [zoom, setZoom] = useState<{ id: string; el: HTMLElement } | null>(null);
  const [open, setOpen] = useState(params.has('new'));
  const [lessonId] = useState(params.get('lesson'));
  const me = s.user?.email || '';
  const rows = useMemo(() => visibleLessons(s.lessonFeedbacks, s.viewer, me).filter(matches).sort((a, b) => b.date.localeCompare(a.date)), [s.lessonFeedbacks, s.viewer, me, matches]);
  const remove = async (f: LessonFeedback) => { if (!confirmDelete('课情反馈')) return false; if (await s.removeRecord('lessonFeedbacks', f.id)) { toast.success('已删除'); return true; } return false; };
  const close = () => { setOpen(false); setEditing(null); if (s.route.includes('new')) s.go('lesson-feedback'); };
  return <>
    <PageTitle title="课情反馈" en="LESSON FEEDBACK" description={all ? '部门负责人：按老师查看全部课情反馈，按月份与项目筛选。' : '每节课后记录到课、内容与学生布置（记录课时时也可一并填写）；只有你和部门负责人能看到。'} action="记录反馈" onAction={() => { setEditing(null); setOpen(true); }} />
    {all && <PersonTabs value={teacher} onChange={setTeacher} counts={new Map(s.staff.map(u => [u.email.toLowerCase(), visibleLessons(s.lessonFeedbacks, s.viewer, me).filter(f => f.opsTeacher.toLowerCase() === u.email.toLowerCase() && (!month || monthOf(f.date) === month)).length]))} />}
    <section className="glass panel">
      {toolbar}
      {!s.opsCourses.length ? <NoCourses /> : <>
        <div className="results-meta">{rows.length} 条反馈<span>{month ? monthLabel(month) : '全部月份'} · {all ? '全部老师' : '仅显示你的反馈'}</span></div>
        {rows.length ? <div className="lf-grid">{rows.map(f => { const c = course(f.course); const l = f.lesson ? s.lessons.find(x => x.id === f.lesson) : undefined; const preview = f.content || f.performance || f.nextSteps || f.issues || ''; const title = c?.name || '已删除的课程';
          const open = (e: { currentTarget: HTMLElement }) => setZoom({ id: f.id, el: e.currentTarget });
          return <article key={f.id} className={'lf-card' + (zoom?.id === f.id ? ' is-zoom-source' : '')} tabIndex={0} aria-haspopup="dialog" aria-label={`${title} · ${f.date}，查看完整课情反馈`}
            onClick={e => { if ((e.target as HTMLElement).closest('button,a')) return; open(e); }}
            onKeyDown={e => { if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); open(e); }}>
            <div className="lf-card-head"><h3 title={title}>{title}</h3>
              <div className="row-actions"><button className="icon-button" aria-label="编辑" title="编辑" onClick={() => { setEditing(f); setOpen(true); }}><Pencil size={15} /></button><button className="icon-button" aria-label="删除" title="删除" onClick={() => remove(f)}><Trash2 size={15} /></button></div>
            </div>
            <FeedbackMeta code={c?.code} date={f.date} teacher={s.staffName(f.opsTeacher)} attendance={f.attendance} hours={l?.hours} />
            <p className="lf-preview">{preview || <span className="muted">未填写内容</span>}</p>
          </article>; })}</div>
          : <EmptyState icon={MessageSquareText} title={month ? `${monthLabel(month)}还没有课情反馈` : '还没有课情反馈'} description="课后花一分钟记录到课、内容与表现，也可以从课时记录一键生成。" action="记录反馈" onAction={() => { setEditing(null); setOpen(true); }} />}
      </>}
    </section>
    {zoom && (() => { const f = s.lessonFeedbacks.find(x => x.id === zoom.id); if (!f) return null; const c = course(f.course); const l = f.lesson ? s.lessons.find(x => x.id === f.lesson) : undefined; const title = c?.name || '已删除的课程';
      const sections = ([['本次内容', f.content], ['学生布置', f.performance], ['问题与风险', f.issues], ['下一步', f.nextSteps]] as const).filter(([, v]) => v);
      return <ZoomModal origin={zoom.el} label={`课情反馈：${title}`} onClosed={() => setZoom(null)}><div className="lf-detail">
        <div className="eyebrow">LESSON FEEDBACK</div>
        <h2>{title}</h2>
        <FeedbackMeta code={c?.code} date={f.date} teacher={s.staffName(f.opsTeacher)} attendance={f.attendance} hours={l?.hours} />
        {sections.length ? <dl>{sections.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : <p className="muted">这条反馈还没有填写内容。</p>}
        <div className="lf-detail-actions"><button type="button" className="secondary compact" onClick={() => { setZoom(null); setEditing(f); setOpen(true); }}><Pencil size={15} />编辑</button><button type="button" className="text-button danger" onClick={async () => { if (await remove(f)) setZoom(null); }}><Trash2 size={15} />删除</button></div>
      </div></ZoomModal>; })()}
    {open && <FeedbackDialog key={editing?.id || 'new'} record={editing} lessonId={editing ? null : lessonId} open={open} onClose={close} />}
  </>;
}

/** 当月教务津贴 for the dashboard KPI: own records; the 部门负责人 sees the whole team's total. */
export function useMonthAllowance() {
  const s = useNexus();
  const month = currentMonth();
  if (canSeeAllLessons(s.viewer)) {
    const list = s.lessons.filter(r => monthOf(r.date) === month);
    return { month, team: true, amount: Math.round(list.reduce((n, r) => n + r.amount, 0) * 100) / 100, hours: Math.round(list.reduce((n, r) => n + r.hours, 0) * 100) / 100, count: list.length };
  }
  return { month, team: false, ...monthAllowance(s.lessons, s.user?.email || '', month) };
}
