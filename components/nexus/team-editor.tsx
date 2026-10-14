'use client';
/**
 * 队伍管理 · 编辑队伍 drawer: 名称 / 项目 / 老师 / 负责人 / 名额 / 招募状态 / 海报 / 成员, plus 删除队伍.
 * Who may edit: the team's 负责人 (ops owner) and superadmins; everyone else sees it read-only.
 * 剩余名额 = 名额 − 已招 (live: max(当前成员数, 记录的已招人数)). The sales 火热招募 tile reads the same columns.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Lock, Trash2, Upload, UserMinus, UserPlus, ImageIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { useNexus } from '@/lib/nexus/store';
import { api } from '@/lib/nexus/api';
import type { Team } from '@/lib/nexus/data';
import { TEAM_RECRUIT_STATUSES, normalizeRecruitStatus, teamEnrolled, teamRemaining, canEditTeam, inactiveEnrollment } from '@/lib/nexus/sales';
import { Badge, Choice, FormField, Notice } from './ui';

const TEAM_STATUSES = ['正常进行', '需要关注', '已暂停', '已结项'];
const num = (v: string) => v.trim() === '' ? null : Math.max(0, Math.floor(Number(v)) || 0);

export function useTeamAccess(team?: Team) {
  const s = useNexus();
  return !!team && canEditTeam({ role: s.user?.role ?? (s.role === 'sales' ? 'sales' : 'superadmin'), name: s.user?.name, email: s.user?.email }, team);
}

export function TeamEditor({ team, open, onOpenChange }: { team: Team; open: boolean; onOpenChange: (v: boolean) => void }) {
  const s = useNexus();
  const editable = useTeamAccess(team);
  const superadmin = (s.user?.role ?? 'superadmin') === 'superadmin';
  const [f, setF] = useState(() => ({
    name: team.name, program: team.program, teacher: team.teacher || '', opsOwner: team.opsOwner || '', status: team.status || '正常进行', note: team.note || '',
    recruitStatus: normalizeRecruitStatus(team.recruitStatus) || '招募中', capacity: team.recruitCapacity != null ? String(team.recruitCapacity) : '', recorded: team.recruitEnrolled != null ? String(team.recruitEnrolled) : '',
  }));
  const [poster, setPoster] = useState(team.posterUrl || '');
  const [uploading, setUploading] = useState(false);
  const [pick, setPick] = useState('');
  const [confirm, setConfirm] = useState(false);
  const members = s.enrollments.filter(e => e.team === team.id && !inactiveEnrollment(e.status));
  const live = new Set(members.map(e => e.student)).size;
  const enrolled = teamEnrolled(live, num(f.recorded));
  const remaining = teamRemaining(num(f.capacity), enrolled);
  const candidates = useMemo(() => s.students.filter(x => !members.some(e => e.student === x.id)).sort((a, b) => Number(b.program === team.program) - Number(a.program === team.program) || a.name.localeCompare(b.name, 'zh-CN')), [s.students, members, team.program]);
  const refs = { courses: s.courses.filter(c => c.team === team.id).length, members: s.enrollments.filter(e => e.team === team.id).length + s.students.filter(x => x.team === team.id).length };
  const set = (k: keyof typeof f) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const log = (action: string, detail: string) => s.setTeamLogs(a => [{ id: 'TL-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), team: team.id, at: new Date().toLocaleString('zh-CN', { hour12: false }), by: s.user?.email || '', byName: s.user?.name || '系统', action, detail }, ...a]);

  const save = () => {
    if (!editable) return;
    if (!f.name.trim()) return toast.error('请填写队伍名称');
    const next: Team = { ...team, name: f.name.trim(), program: f.program, teacher: f.teacher.trim(), opsOwner: f.opsOwner.trim() || undefined, status: f.status, note: f.note,
      recruitStatus: f.recruitStatus, recruitCapacity: num(f.capacity), recruitEnrolled: num(f.recorded), posterUrl: poster || null };
    s.setTeams(a => a.map(x => x.id === team.id ? next : x));
    log('编辑队伍', `名额 ${next.recruitCapacity ?? '待定'} · 已招 ${enrolled} · 剩余 ${remaining ?? '—'} · ${f.recruitStatus}`);
    toast.success('队伍已保存，销售端同步更新');
    onOpenChange(false);
  };
  const upload = async (file?: File) => {
    if (!file || !editable) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast.error('仅支持 JPG / PNG / WebP 图片');
    if (file.size > 8 * 1024 * 1024) return toast.error('图片需小于 8 MB');
    if (!s.apiMode) { setPoster(URL.createObjectURL(file)); return; }
    setUploading(true);
    try { const r = await api.uploadTeamPoster(team.id, file); setPoster(r.url); s.setTeams(a => a.map(x => x.id === team.id ? { ...x, posterUrl: r.url } : x)); log('更换海报', file.name); toast.success('海报已上传'); }
    catch { toast.error('海报上传失败'); } finally { setUploading(false); }
  };
  const addMember = () => {
    const st = s.students.find(x => x.id === pick); if (!st) return;
    s.setEnrollments(a => [...a.filter(e => !(e.student === st.id && e.team === team.id)), { id: 'E-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), student: st.id, program: team.program, team: team.id, status: '进行中' }]);
    log('添加成员', st.name); setPick('');
  };
  const removeMember = (enrollmentId: string, name: string) => {
    s.setEnrollments(a => a.map(e => e.id === enrollmentId ? { ...e, status: '已退出' } : e));
    log('移除成员', name);
  };
  const remove = async () => {
    try {
      const r = s.apiMode ? await api.deleteTeam(team.id) : { ok: true as const, archived: refs.courses + refs.members > 0 };
      if (r.archived) { s.setTeams(a => a.map(x => x.id === team.id ? { ...x, archived: true, status: '已解散', recruitStatus: '已结束' } : x)); toast.success('队伍已归档（保留课程与成员记录）'); }
      else { s.setTeams(a => a.filter(x => x.id !== team.id)); toast.success('队伍已删除'); }
      setConfirm(false); onOpenChange(false); s.go('teams');
    } catch { toast.error('删除失败：仅队伍负责人或超级管理员可删除'); }
  };

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="team-editor" side="right">
      <SheetHeader><SheetTitle>{editable ? '编辑队伍' : '队伍信息'}</SheetTitle>
        <SheetDescription>{editable ? '修改名额、招募状态、海报与成员后保存，销售端「火热招募中」即时同步。' : `只读 · 仅队伍负责人${team.opsOwner ? `（${team.opsOwner}）` : ''}或超级管理员可编辑`}</SheetDescription></SheetHeader>
      <div className="form-stack team-editor-body">
        {!editable && <Notice><Lock size={14} /> 你不是该队伍的负责人，以下内容只读。</Notice>}
        <FormField label="队伍名称"><input value={f.name} disabled={!editable} onChange={e => set('name')(e.target.value)} /></FormField>
        <FormField label="所属项目"><select value={f.program} disabled={!editable} onChange={e => set('program')(e.target.value)}>{s.programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FormField>
        <div className="team-editor-grid">
          <FormField label="带队 / 指导老师"><input value={f.teacher} disabled={!editable} onChange={e => set('teacher')(e.target.value)} /></FormField>
          <FormField label="运营负责人"><input value={f.opsOwner} disabled={!editable || (!superadmin && !!team.opsOwner)} onChange={e => set('opsOwner')(e.target.value)} placeholder="姓名" /></FormField>
        </div>
        <div className="team-editor-grid">
          <FormField label="招募状态">{editable ? <Choice value={f.recruitStatus} onChange={set('recruitStatus')} options={[...TEAM_RECRUIT_STATUSES]} label="招募状态" /> : <input value={f.recruitStatus} disabled />}</FormField>
          <FormField label="队伍状态">{editable ? <Choice value={TEAM_STATUSES.includes(f.status) ? f.status : f.status} onChange={set('status')} options={TEAM_STATUSES.includes(f.status) ? TEAM_STATUSES : [f.status, ...TEAM_STATUSES]} label="队伍状态" /> : <input value={f.status} disabled />}</FormField>
        </div>
        <div className="team-editor-grid three">
          <FormField label="名额"><input type="number" inputMode="numeric" min={0} value={f.capacity} disabled={!editable} onChange={e => set('capacity')(e.target.value)} placeholder="待定" /></FormField>
          <FormField label="已招人数（记录）"><input type="number" inputMode="numeric" min={0} value={f.recorded} disabled={!editable} onChange={e => set('recorded')(e.target.value)} placeholder={String(live)} /></FormField>
          <div className="team-seat-calc"><span>剩余名额</span><b className={remaining === 0 ? 'full' : ''}>{remaining ?? '—'}</b><small>名额 − 已招 {enrolled}（成员 {live} 人）</small></div>
        </div>
        <FormField label="课题海报"><div className="team-poster-edit">
          {poster ? <img src={poster} alt="课题海报" /> : <span className="team-poster-empty"><ImageIcon size={22} />暂无海报</span>}
          {editable && <label className="secondary compact"><Upload size={15} />{uploading ? '上传中…' : poster ? '更换海报' : '上传海报'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploading} onChange={e => upload(e.target.files?.[0])} /></label>}
        </div></FormField>
        <FormField label={`成员 · ${live} 人`}><div className="team-members-edit">
          {members.map(e => { const st = s.students.find(x => x.id === e.student); return <div key={e.id} className="team-member-row"><span>{st?.name || e.student}</span><small>{st?.grade}</small><Badge>{e.status}</Badge>{editable && <button type="button" className="text-button danger" aria-label={`移除 ${st?.name}`} onClick={() => removeMember(e.id, st?.name || e.student)}><UserMinus size={15} /></button>}</div>; })}
          {!members.length && <p className="muted">暂无成员</p>}
          {editable && <div className="team-member-add"><select value={pick} onChange={e => setPick(e.target.value)} aria-label="选择学生"><option value="">选择学生加入队伍…</option>{candidates.map(x => <option key={x.id} value={x.id}>{x.name} · {x.grade}{x.program !== team.program ? '（其他项目）' : ''}</option>)}</select><button type="button" className="secondary compact" disabled={!pick} onClick={addMember}><UserPlus size={15} />添加</button></div>}
        </div></FormField>
        <FormField label="备注"><textarea rows={3} value={f.note} disabled={!editable} onChange={e => set('note')(e.target.value)} /></FormField>
        {editable && <div className="team-editor-actions">
          <button type="button" className="secondary danger" onClick={() => setConfirm(true)}><Trash2 size={15} />删除队伍</button>
          <button type="button" className="primary" onClick={save}>保存</button>
        </div>}
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent>
        <AlertDialogTitle>删除队伍「{team.name}」？</AlertDialogTitle>
        <AlertDialogDescription>{refs.courses + refs.members > 0
          ? `该队伍仍关联 ${refs.courses} 门课程、${refs.members} 条成员记录。为保护排课、课时与学生档案，不会物理删除，而是归档（标记为已解散、停止招募、从列表中隐藏），相关记录全部保留。`
          : '该队伍没有关联课程或成员，将被永久删除，且无法恢复。'}</AlertDialogDescription>
        <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={remove}>{refs.courses + refs.members > 0 ? '归档队伍' : '永久删除'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </SheetContent>
  </Sheet>;
}
