'use client';
/**
 * 收集表单 (superadmin): 填写记录 (search / filter / detail / export / status / 队伍绑定分发),
 * 表单编辑 (bilingual questions, reorder, options, profile mapping) and 分享 (link, QR PNG, open/close).
 * The server enforces superadmin on every /admin/forms* call; this page only hides itself for others.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Ban, Check, ClipboardList, Copy, Download, ExternalLink, FileSpreadsheet, Link2, Lock, PencilRuler, Plus, QrCode, RotateCcw, Save, Search, Share2, ShieldCheck, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useNexus } from '@/lib/nexus/store';
import { canManageSystem } from '@/lib/nexus/roles';
import { formsApi, formUrl, ApiError, type AdminForm, type DuplicateMap } from '@/lib/nexus/api';
import {
  PROFILE_TARGETS, QUESTION_TYPES, QUESTION_TYPE_LABELS, SUBMISSION_STATUSES, answerText, hasOptions, submissionTable, toCsv,
  type FormDef, type FormQuestion, type Submission, type SubmissionStatus,
} from '@/lib/nexus/forms';
import { buildXlsx } from '@/lib/nexus/xlsx';
import { PageTitle, EmptyState, Picker } from './ui';

const tabs = [{ id: 'subs', label: '填写记录', icon: ClipboardList }, { id: 'edit', label: '表单编辑', icon: PencilRuler }, { id: 'share', label: '分享与收集', icon: Share2 }] as const;
type Tab = typeof tabs[number]['id'];
const tone: Record<SubmissionStatus, string> = { 待分配: 'orange', 已分配: 'green', 已忽略: 'neutral' };
const when = (iso: string) => new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const pick = (s: Submission, key: string) => answerText(s.answers.find(a => a.mapTo === key)?.value);
function save(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function FormsPage() {
  const s = useNexus();
  const [forms, setForms] = useState<AdminForm[] | null>(null);
  const [active, setActive] = useState('');
  const [tab, setTab] = useState<Tab>('subs');
  const load = async () => { try { const r = await formsApi.list(); setForms(r.forms); setActive(a => r.forms.some(f => f.id === a) ? a : r.forms[0]?.id || ''); } catch (e) { toast.error(e instanceof ApiError && e.message ? e.message : '加载收集表单失败'); setForms([]); } };
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- initial fetch
  useEffect(() => { if (canManageSystem(s.role)) load(); }, [s.role]);
  if (!canManageSystem(s.role)) return <EmptyState icon={ShieldCheck} title="仅超级管理员可访问" description="收集表单的填写记录在分配到队伍前，只有超级管理员可以查看。" />;
  const form = forms?.find(f => f.id === active);
  const create = async (template: 'default' | 'blank') => { try { const r = await formsApi.create(template); toast.success('已新建表单（默认关闭收集）'); await load(); setActive(r.form.id); setTab('edit'); } catch (e) { toast.error(e instanceof ApiError && e.message ? e.message : '新建失败'); } };
  return <>
    <PageTitle title="收集表单" en="REGISTRATION FORMS" description="学生扫码自主填写报名信息；超级管理员审核后分配到项目队伍，分配后运营与销售按现有权限可见。" />
    <div className="fa-bar">
      {forms && forms.length > 0 && <Picker label="选择表单" className="fa-form-pick" value={active} onChange={setActive} options={forms.map(f => ({ value: f.id, label: `${f.title}${f.open ? '' : '（已关闭）'} · ${f.counts.pending} 待分配` }))} />}
      <button className="secondary compact" onClick={() => create('default')}><Plus size={15} />从模板新建</button>
      <button className="secondary compact" onClick={() => create('blank')}><Plus size={15} />空白表单</button>
    </div>
    {forms === null ? <div className="glass panel fa-loading">正在加载…</div> : !form ? <EmptyState icon={ClipboardList} title="还没有收集表单" description="从模板新建「各项竞赛报名学员信息收集表」。" action="从模板新建" onAction={() => create('default')} /> : <>
      <div className="admin-tabs" role="tablist">{tabs.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'selected' : ''} onClick={() => setTab(t.id)}><t.icon size={16} />{t.label}{t.id === 'subs' && form.counts.pending > 0 && <em className="fa-count">{form.counts.pending}</em>}</button>)}</div>
      {tab === 'subs' && <SubmissionsTab key={form.id} form={form} onChanged={load} />}
      {tab === 'edit' && <EditorTab key={form.id + ':' + form.version} form={form} onSaved={load} />}
      {tab === 'share' && <ShareTab key={form.id} form={form} onSaved={load} />}
    </>}
  </>;
}

// ------------------------------------------------------------------ 填写记录
function SubmissionsTab({ form, onChanged }: { form: AdminForm; onChanged: () => void }) {
  const s = useNexus();
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'全部' | SubmissionStatus>('待分配');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Submission | null>(null);
  const [assigning, setAssigning] = useState<Submission[] | null>(null);
  const load = async () => { try { setSubs((await formsApi.submissions(form.id)).submissions); } catch { toast.error('加载填写记录失败'); setSubs([]); } };
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- fetch per form
  useEffect(() => { load(); }, [form.id]);
  const programName = (id: string) => s.programs.find(p => p.id === id)?.name || id;
  const teamName = (id: string) => s.teams.find(t => t.id === id)?.name || id;
  const list = useMemo(() => (subs || []).filter(x => (status === '全部' || x.status === status) && (!q.trim() || JSON.stringify(x.answers).toLowerCase().includes(q.trim().toLowerCase()))), [subs, q, status]);
  const counts = useMemo(() => Object.fromEntries(SUBMISSION_STATUSES.map(st => [st, (subs || []).filter(x => x.status === st).length])), [subs]);
  const toggle = (id: string) => setSel(v => { const n = new Set(v); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = list.length > 0 && list.every(x => sel.has(x.id));
  const chosen = (subs || []).filter(x => sel.has(x.id));
  const setStatusOf = async (items: Submission[], st: SubmissionStatus) => {
    try { for (const x of items) await formsApi.patch(x.id, { status: st }); toast.success(st === '已忽略' ? `已忽略 ${items.length} 条` : `已恢复 ${items.length} 条为待分配`); setSel(new Set()); setDetail(null); await load(); onChanged(); }
    catch (e) { toast.error(e instanceof ApiError && e.message ? e.message : '操作失败'); }
  };
  const exportAs = (kind: 'csv' | 'xlsx') => {
    const rows = submissionTable(list, programName, teamName);
    const base = `${form.title}-${new Date().toISOString().slice(0, 10)}`;
    if (kind === 'csv') save(base + '.csv', toCsv(rows), 'text/csv;charset=utf-8');
    else save(base + '.xlsx', buildXlsx(rows, '填写记录') as BlobPart, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };
  return <section className="glass panel fa-subs">
    <div className="fa-toolbar">
      <label className="search-box fa-search"><Search size={17} /><input placeholder="搜索姓名、手机、学校、任意答案…" value={q} onChange={e => setQ(e.target.value)} aria-label="搜索填写记录" /></label>
      <div className="fa-chips" role="tablist">{(['全部', ...SUBMISSION_STATUSES] as const).map(st => <button key={st} className={status === st ? 'on' : ''} onClick={() => { setStatus(st); setSel(new Set()); }}>{st}<em>{st === '全部' ? subs?.length ?? 0 : counts[st] ?? 0}</em></button>)}</div>
      <div className="fa-actions">
        <button className="secondary compact" onClick={() => exportAs('csv')} disabled={!list.length}><Download size={15} />CSV</button>
        <button className="secondary compact" onClick={() => exportAs('xlsx')} disabled={!list.length}><FileSpreadsheet size={15} />Excel</button>
      </div>
    </div>
    {sel.size > 0 && <div className="fa-bulk"><span>已选 {sel.size} 条</span>
      <button className="primary compact" onClick={() => setAssigning(chosen.filter(x => x.status !== '已忽略'))} disabled={!chosen.some(x => x.status !== '已忽略')}><UsersRound size={15} />分配队伍 / 销售</button>
      <button className="secondary compact" onClick={() => setStatusOf(chosen.filter(x => x.status === '待分配'), '已忽略')} disabled={!chosen.some(x => x.status === '待分配')}><Ban size={15} />忽略</button>
      <button className="text-button" onClick={() => setSel(new Set())}>取消选择</button></div>}
    {subs === null ? <p className="fa-empty">正在加载…</p> : !list.length ? <p className="fa-empty">{subs.length ? '没有符合筛选条件的记录' : '还没有人填写。到「分享与收集」复制链接或下载二维码发给学生。'}</p> :
    <div className="fa-table-wrap"><table className="fa-table">
      <thead><tr><th className="fa-ck"><input type="checkbox" aria-label="全选" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(list.map(x => x.id)))} /></th><th>提交时间</th><th>学生</th><th>手机</th><th>学校 / 年级</th><th>报名项目</th><th>状态</th><th>分配到</th></tr></thead>
      <tbody>{list.map(x => <tr key={x.id} className={sel.has(x.id) ? 'is-sel' : ''} onClick={() => setDetail(x)}>
        <td className="fa-ck" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={'选择 ' + x.name} checked={sel.has(x.id)} onChange={() => toggle(x.id)} /></td>
        <td className="fa-muted">{when(x.createdAt)}</td>
        <td><b>{x.name || '—'}</b><small>{pick(x, 'name').replace(x.name, '').trim()}</small></td>
        <td className="mono">{x.phone}</td>
        <td>{pick(x, 'school') || '—'}<small>{pick(x, 'grade')}</small></td>
        <td className="fa-programs">{pick(x, 'signupPrograms') || '—'}</td>
        <td><span className={'badge ' + tone[x.status]}>{x.status}</span></td>
        <td>{x.team ? <><b>{teamName(x.team)}</b><small>{programName(x.program || '')}</small></> : <span className="fa-muted">—</span>}</td>
      </tr>)}</tbody>
    </table></div>}
    <DetailDialog sub={detail} onClose={() => setDetail(null)} teamName={teamName} programName={programName}
      onAssign={x => { setDetail(null); setAssigning([x]); }} onStatus={(x, st) => setStatusOf([x], st)}
      onDelete={async x => { if (!confirm(`删除「${x.name}」的填写记录？此操作不可恢复（已建档的学生不受影响）。`)) return; try { await formsApi.removeSubmission(x.id); toast.success('已删除'); setDetail(null); await load(); onChanged(); } catch { toast.error('删除失败'); } }} />
    <AssignDialog items={assigning} onClose={() => setAssigning(null)} onDone={async () => { setAssigning(null); setSel(new Set()); await load(); onChanged(); await s.refresh(); }} />
  </section>;
}

function DetailDialog({ sub, onClose, onAssign, onStatus, onDelete, teamName, programName }: { sub: Submission | null; onClose: () => void; onAssign: (x: Submission) => void; onStatus: (x: Submission, st: SubmissionStatus) => void; onDelete: (x: Submission) => void; teamName: (id: string) => string; programName: (id: string) => string }) {
  const s = useNexus();
  const [dups, setDups] = useState<{ studentId: string; name: string; phone: string; strength: string }[]>([]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the dialog opens another row
  useEffect(() => { setDups([]); if (sub && sub.status !== '已分配') formsApi.duplicates(sub.id).then(r => setDups(r.duplicates)).catch(() => {}); }, [sub]);
  return <Dialog open={!!sub} onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog fa-detail">
    {sub && <>
      <DialogTitle>{sub.name || '未命名'} <span className={'badge ' + tone[sub.status]}>{sub.status}</span></DialogTitle>
      <DialogDescription>提交于 {when(sub.createdAt)}（北京时间）· 表单版本 v{sub.formVersion} · 记录号 {sub.id}</DialogDescription>
      {sub.status === '已分配' && sub.team && <div className="fa-assigned"><Check size={16} />已分配到 <b>{programName(sub.program || '')} · {teamName(sub.team)}</b>{(() => { const st = s.students.find(x => x.id === sub.studentId); return st ? <> · 负责销售：{st.sales || '未绑定'}</> : null; })()}{sub.assignedBy && <> · {sub.assignedBy}</>}{sub.studentId && <button className="text-button" onClick={() => { onClose(); s.go('students/' + sub.studentId); }}>查看学生档案 <ExternalLink size={13} /></button>}</div>}
      {dups.length > 0 && <div className="fa-dup"><strong>可能重复的学生</strong>{dups.map(d => <span key={d.studentId}>{d.name} · {d.phone || '无手机'} · {d.strength === 'name+phone' ? '姓名+手机一致' : d.strength === 'phone' ? '手机一致' : '同名'} <button className="text-button" onClick={() => { onClose(); s.go('students/' + d.studentId); }}>查看 <ExternalLink size={12} /></button></span>)}</div>}
      <dl className="fa-answers">{sub.answers.map(a => <div key={a.id}><dt>{a.labelZh}<small>{a.labelEn}</small></dt><dd>{answerText(a.value) || '—'}</dd></div>)}</dl>
      <div className="actions">
        <button className="text-button fa-danger" onClick={() => onDelete(sub)}><Trash2 size={14} />删除记录</button>
        {sub.status === '待分配' && <button className="secondary" onClick={() => onStatus(sub, '已忽略')}><Ban size={16} />忽略</button>}
        {sub.status === '已忽略' && <button className="secondary" onClick={() => onStatus(sub, '待分配')}><RotateCcw size={16} />恢复待分配</button>}
        {sub.status !== '已分配' ? <button className="primary" onClick={() => onAssign(sub)}><UsersRound size={16} />分配到队伍</button> : <button className="secondary" onClick={() => onAssign(sub)}><UsersRound size={16} />修改队伍 / 负责销售</button>}
      </div>
    </>}
  </DialogContent></Dialog>;
}

function AssignDialog({ items, onClose, onDone }: { items: Submission[] | null; onClose: () => void; onDone: () => void }) {
  const s = useNexus();
  const [program, setProgram] = useState('');
  const [team, setTeam] = useState('');
  const [q, setQ] = useState('');
  const [salesId, setSalesId] = useState<number | null>(null);
  const [salesQ, setSalesQ] = useState('');
  const [accounts, setAccounts] = useState<{ id: number; name: string; salesName: string | null; region: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (items && !accounts.length) formsApi.salesAccounts().then(r => setAccounts(r.accounts)).catch(() => toast.error('加载销售账号失败')); }, [items, accounts.length]);
  const [dups, setDups] = useState<DuplicateMap | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when reopened
  useEffect(() => { if (items) { setTeam(''); setQ(''); setDups(null); setLinks({}); setSalesQ(''); const st = items.length === 1 && items[0].studentId ? s.students.find(x => x.id === items[0].studentId) : null; setSalesId(st ? accounts.find(a => a.name === st.sales)?.id ?? null : null); if (items.length === 1 && items[0].team) { setTeam(items[0].team); setProgram(items[0].program || ''); } } }, [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const teams = s.teams.filter(t => !t.archived && (!program || t.program === program) && (!q.trim() || (t.name + ' ' + (s.programs.find(p => p.id === t.program)?.name || '') + ' ' + t.teacher).toLowerCase().includes(q.trim().toLowerCase())));
  const run = async () => {
    if (!items?.length || !team) return;
    setBusy(true);
    try {
      const r = await formsApi.assign({ ids: items.map(x => x.id), team, salesUserId: salesId, links: dups ? links : undefined });
      const created = r.results.filter(x => x.created).length;
      toast.success(`已分配 ${r.results.length} 名学生（新建档案 ${created}，关联已有 ${r.results.length - created}）`);
      onDone();
    } catch (e) {
      const err = e as ApiError;
      if (err instanceof ApiError && err.code === 'duplicates') {
        // Re-fetch the matches so every flagged row gets a choice (default: link the strongest match).
        const map: DuplicateMap = {};
        for (const x of items) { try { const d = (await formsApi.duplicates(x.id)).duplicates.filter(m => m.strength !== 'name'); if (d.length) map[x.id] = d; } catch { /* ignore */ } }
        setDups(map); setLinks(l => { const n = { ...l }; for (const x of items) if (n[x.id] === undefined) n[x.id] = map[x.id]?.[0]?.studentId || 'new'; return n; });
        toast.warning('发现可能重复的学生，请确认关联方式后再次提交');
      } else toast.error(err instanceof ApiError && err.message ? err.message : '分配失败');
    } finally { setBusy(false); }
  };
  const chosenTeam = s.teams.find(t => t.id === team);
  return <Dialog open={!!items} onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog fa-assign">
    <DialogTitle>分配队伍与负责销售</DialogTitle>
    <DialogDescription>为 {items?.length || 0} 名学生建档（或关联已有档案）并加入所选队伍。分配后，运营与负责销售按现有权限可见。</DialogDescription>
    <div className="fa-assign-grid">
      <Picker label="项目" value={program} onChange={v => { setProgram(v); setTeam(''); }} options={[{ value: '', label: '全部项目' }, ...s.programs.map(p => ({ value: p.id, label: p.name }))]} />
      <label className="search-box"><Search size={16} /><input placeholder="搜索队伍 / 老师…" value={q} onChange={e => setQ(e.target.value)} aria-label="搜索队伍" /></label>
    </div>
    <div className="fa-team-list" role="listbox" aria-label="队伍">{teams.length ? teams.slice(0, 80).map(t => <button key={t.id} role="option" aria-selected={team === t.id} className={team === t.id ? 'on' : ''} onClick={() => setTeam(t.id)}>
      <span><b>{t.name}</b><small>{s.programs.find(p => p.id === t.program)?.name} · {t.teacher || '未定老师'}</small></span>{team === t.id && <Check size={16} />}
    </button>) : <p className="fa-empty">没有匹配的队伍</p>}</div>
    <div className="form-field"><span>负责销售（选填 · 被选中的销售账号即可在「我的学生」看到该学生）</span>
      <div className="fa-sales">
        <label className="search-box"><Search size={16} /><input placeholder="搜索销售姓名 / 区域…" value={salesQ} onChange={e => setSalesQ(e.target.value)} aria-label="搜索销售" /></label>
        <div className="fa-team-list fa-sales-list" role="listbox" aria-label="负责销售">
          <button role="option" aria-selected={salesId === null} className={salesId === null ? 'on' : ''} onClick={() => setSalesId(null)}><span><b>暂不绑定销售</b><small>仅运营可见；稍后可在此修改</small></span>{salesId === null && <Check size={16} />}</button>
          {accounts.filter(a => !salesQ.trim() || (a.name + ' ' + (a.salesName || '') + ' ' + (a.region || '')).toLowerCase().includes(salesQ.trim().toLowerCase())).map(a => <button key={a.id} role="option" aria-selected={salesId === a.id} className={salesId === a.id ? 'on' : ''} onClick={() => setSalesId(a.id)}><span><b>{a.name}</b><small>{a.region || '未分区'}{a.salesName && a.salesName !== a.name ? ' · ' + a.salesName : ''}</small></span>{salesId === a.id && <Check size={16} />}</button>)}
        </div>
      </div>
    </div>
    {dups && Object.keys(dups).length > 0 && <div className="fa-dup-resolve"><strong>疑似重复 · 请选择</strong>{items?.filter(x => dups[x.id]).map(x => <div key={x.id} className="fa-dup-row">
      <span className="fa-dup-who">{x.name} <small className="mono">{x.phone}</small></span>
      <div className="fa-dup-opts">{dups[x.id].map(m => <label key={m.studentId}><input type="radio" name={'dup-' + x.id} checked={links[x.id] === m.studentId} onChange={() => setLinks(l => ({ ...l, [x.id]: m.studentId }))} />关联已有：{m.name}（{m.strength === 'name+phone' ? '姓名+手机一致' : '手机一致'}）<a href={'#/students/' + m.studentId} target="_blank" rel="noreferrer"><ExternalLink size={12} /></a></label>)}
        <label><input type="radio" name={'dup-' + x.id} checked={links[x.id] === 'new'} onChange={() => setLinks(l => ({ ...l, [x.id]: 'new' }))} />仍然新建学生</label></div>
    </div>)}</div>}
    <div className="actions"><button className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={!team || busy} onClick={run}><UserPlus size={16} />{busy ? '分配中…' : chosenTeam ? `分配到「${chosenTeam.name}」${salesId != null ? ' · ' + (accounts.find(a => a.id === salesId)?.name || '') : ''}` : '请选择队伍'}</button></div>
  </DialogContent></Dialog>;
}

// ------------------------------------------------------------------ 表单编辑
const blankQuestion = (type: FormQuestion['type']): FormQuestion => ({ id: 'q' + Math.random().toString(36).slice(2, 8), type, labelZh: type === 'section' ? '新分组' : '新题目', labelEn: '', helpZh: '', helpEn: '', placeholder: '', required: false, options: hasOptions(type) ? [{ value: '选项1', zh: '选项1', en: 'Option 1' }] : [], requireAll: false, mapTo: '' });
function EditorTab({ form, onSaved }: { form: FormDef; onSaved: () => void }) {
  const [draft, setDraft] = useState<FormDef>(() => structuredClone(form));
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(form);
  const setQ = (i: number, patch: Partial<FormQuestion>) => setDraft(d => ({ ...d, questions: d.questions.map((q, j) => j === i ? { ...q, ...patch } : q) }));
  const move = (i: number, by: number) => setDraft(d => { const qs = [...d.questions]; const j = i + by; if (j < 0 || j >= qs.length) return d; [qs[i], qs[j]] = [qs[j], qs[i]]; return { ...d, questions: qs }; });
  const add = (type: FormQuestion['type']) => { const q = blankQuestion(type); setDraft(d => ({ ...d, questions: [...d.questions, q] })); setOpen(q.id); };
  const submit = async () => { setBusy(true); try { await formsApi.save(draft); toast.success('表单已保存；已有填写记录保留原题目快照'); onSaved(); } catch (e) { toast.error(e instanceof ApiError && e.message ? e.message : '保存失败'); } finally { setBusy(false); } };
  const numbers: number[] = []; draft.questions.reduce((k, q, i) => { numbers[i] = q.type === 'section' ? k : k + 1; return numbers[i]; }, 0);
  return <section className="glass panel fa-editor">
    <div className="fa-meta">
      <label className="form-field"><span>表单标题（中文）</span><input className="input" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} maxLength={200} /></label>
      <label className="form-field"><span>英文标题 ENGLISH TITLE</span><input className="input" value={draft.titleEn} onChange={e => setDraft({ ...draft, titleEn: e.target.value })} maxLength={300} /></label>
      <label className="form-field fa-wide"><span>说明（中文）</span><textarea className="input" rows={3} value={draft.intro} onChange={e => setDraft({ ...draft, intro: e.target.value })} maxLength={3000} /></label>
      <label className="form-field fa-wide"><span>英文说明 ENGLISH INTRO</span><textarea className="input" rows={2} value={draft.introEn} onChange={e => setDraft({ ...draft, introEn: e.target.value })} maxLength={3000} /></label>
    </div>
    <div className="fa-qlist">{draft.questions.map((q, i) => { const isSec = q.type === 'section', n = numbers[i]; const isOpen = open === q.id; return <div key={q.id} className={'fa-q' + (isSec ? ' is-section' : '') + (isOpen ? ' is-open' : '')}>
      <div className="fa-q-head" onClick={() => setOpen(isOpen ? null : q.id)}>
        <span className="fa-q-no">{isSec ? '§' : String(n).padStart(2, '0')}</span>
        <span className="fa-q-title"><b>{q.labelZh}{q.required && <i className="sf-req">*</i>}</b><small>{q.labelEn}</small></span>
        <span className="badge neutral">{QUESTION_TYPE_LABELS[q.type]}</span>
        {q.mapTo && <span className="badge blue" title="分配时写入学生档案">→ {PROFILE_TARGETS.find(t => t.key === q.mapTo)?.label}</span>}
        <span className="fa-q-tools" onClick={e => e.stopPropagation()}>
          <button className="icon-button" aria-label="上移" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={15} /></button>
          <button className="icon-button" aria-label="下移" onClick={() => move(i, 1)} disabled={i === draft.questions.length - 1}><ArrowDown size={15} /></button>
          <button className="icon-button" aria-label="复制" onClick={() => setDraft(d => { const qs = [...d.questions]; qs.splice(i + 1, 0, { ...structuredClone(q), id: 'q' + Math.random().toString(36).slice(2, 8), mapTo: '' }); return { ...d, questions: qs }; })}><Copy size={15} /></button>
          <button className="icon-button fa-danger" aria-label="删除" onClick={() => { if (confirm(`删除「${q.labelZh}」？已提交的答案仍会保留。`)) setDraft(d => ({ ...d, questions: d.questions.filter((_, j) => j !== i) })); }}><Trash2 size={15} /></button>
        </span>
      </div>
      {isOpen && <div className="fa-q-body">
        <div className="fa-grid">
          <label className="form-field"><span>题型</span><select className="input" value={q.type} onChange={e => { const type = e.target.value as FormQuestion['type']; setQ(i, { type, options: hasOptions(type) ? (q.options.length ? q.options : blankQuestion(type).options) : [], required: type === 'section' ? false : q.required }); }}>{QUESTION_TYPES.map(t => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}</select></label>
          {!isSec && <label className="form-field"><span>写入学生档案字段</span><select className="input" value={q.mapTo} onChange={e => setQ(i, { mapTo: e.target.value })}><option value="">不映射（作为表单补充信息保留）</option>{PROFILE_TARGETS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>}
          <label className="form-field"><span>中文标题</span><input className="input" value={q.labelZh} onChange={e => setQ(i, { labelZh: e.target.value })} maxLength={300} /></label>
          <label className="form-field"><span>英文 ENGLISH（建议全大写）</span><input className="input" value={q.labelEn} onChange={e => setQ(i, { labelEn: e.target.value })} maxLength={300} /></label>
          <label className="form-field"><span>中文说明</span><input className="input" value={q.helpZh} onChange={e => setQ(i, { helpZh: e.target.value })} maxLength={1000} /></label>
          <label className="form-field"><span>英文说明</span><input className="input" value={q.helpEn} onChange={e => setQ(i, { helpEn: e.target.value })} maxLength={1000} /></label>
          {!isSec && !hasOptions(q.type) && <label className="form-field fa-wide"><span>占位提示 Placeholder</span><input className="input" value={q.placeholder} onChange={e => setQ(i, { placeholder: e.target.value })} maxLength={300} /></label>}
        </div>
        {!isSec && <div className="fa-toggles"><label><Switch checked={q.required} onCheckedChange={v => setQ(i, { required: v })} />必填</label>{q.type === 'multi' && <label><Switch checked={q.requireAll} onCheckedChange={v => setQ(i, { requireAll: v })} />必须全部勾选（核对清单）</label>}</div>}
        {hasOptions(q.type) && <div className="fa-options">
          <div className="fa-opt fa-opt-head"><span>中文选项</span><span>English</span><span>其他（可填写）</span><span /></div>
          {q.options.map((o, k) => <div className="fa-opt" key={k}>
            <input className="input" value={o.zh} onChange={e => { const zh = e.target.value; setQ(i, { options: q.options.map((x, m) => m === k ? { ...x, zh, value: x.value === x.zh || !x.value ? zh.slice(0, 120) : x.value } : x) }); }} placeholder="选项" />
            <input className="input" value={o.en} onChange={e => setQ(i, { options: q.options.map((x, m) => m === k ? { ...x, en: e.target.value } : x) })} placeholder="Option" />
            <label className="fa-opt-other"><input type="checkbox" checked={!!o.other} onChange={e => setQ(i, { options: q.options.map((x, m) => m === k ? { ...x, other: e.target.checked || undefined } : x) })} />附填写框</label>
            <span className="fa-q-tools"><button className="icon-button" aria-label="上移选项" disabled={k === 0} onClick={() => { const os = [...q.options]; [os[k - 1], os[k]] = [os[k], os[k - 1]]; setQ(i, { options: os }); }}><ArrowUp size={14} /></button><button className="icon-button fa-danger" aria-label="删除选项" onClick={() => setQ(i, { options: q.options.filter((_, m) => m !== k) })}><Trash2 size={14} /></button></span>
          </div>)}
          <button className="text-button" onClick={() => setQ(i, { options: [...q.options, { value: '选项' + (q.options.length + 1), zh: '选项' + (q.options.length + 1), en: '' }] })}><Plus size={14} />添加选项</button>
        </div>}
      </div>}
    </div>; })}</div>
    <div className="fa-add">{QUESTION_TYPES.map(t => <button key={t} className="secondary compact" onClick={() => add(t)}><Plus size={14} />{QUESTION_TYPE_LABELS[t]}</button>)}</div>
    <div className="fa-savebar"><span>{dirty ? '有未保存的修改 · 修改题目不会改变已提交的答案（按题目快照保存）' : '已保存 · 版本 v' + form.version}</span>
      {dirty && <button className="secondary compact" onClick={() => setDraft(structuredClone(form))}><RotateCcw size={15} />撤销</button>}
      <button className="primary compact" disabled={!dirty || busy} onClick={submit}><Save size={15} />{busy ? '保存中…' : '保存表单'}</button></div>
  </section>;
}

// ------------------------------------------------------------------ 分享
function ShareTab({ form, onSaved }: { form: AdminForm; onSaved: () => void }) {
  const url = formUrl(form.slug);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => { QRCode.toDataURL(url, { width: 640, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2b2236', light: '#ffffff' } }).then(setQr).catch(() => setQr('')); }, [url]);
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast.success('链接已复制'); } catch { toast.error('浏览器限制了复制，请手动选择链接'); } };
  const toggleOpen = async (open: boolean) => { setBusy(true); try { await formsApi.save({ id: form.id, open }); toast.success(open ? '已开放收集' : '已关闭收集，学生将看到「已停止收集」'); onSaved(); } catch (e) { toast.error(e instanceof ApiError && e.message ? e.message : '操作失败'); } finally { setBusy(false); } };
  /** Poster-style PNG: title + QR + hint, for WeChat groups. */
  const downloadPng = async () => {
    if (!qr) return;
    const img = new Image(); img.src = qr; await img.decode();
    const c = canvas.current || document.createElement('canvas'); canvas.current = c;
    const W = 900, H = 1180; c.width = W; c.height = H; const g = c.getContext('2d')!;
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#f4effd'); bg.addColorStop(1, '#eef6fb'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(60, 60, W - 120, H - 120, 40); g.fill();
    g.fillStyle = '#7c4fd6'; g.font = '800 34px Inter, "PingFang SC", sans-serif'; g.textAlign = 'center'; g.fillText('B.E.S.T', W / 2, 150);
    g.fillStyle = '#2b2236'; g.font = '700 40px "PingFang SC", "Microsoft YaHei", sans-serif';
    const words = form.title; const lines = words.length > 14 ? [words.slice(0, Math.ceil(words.length / 2)), words.slice(Math.ceil(words.length / 2))] : [words];
    lines.forEach((l, i) => g.fillText(l, W / 2, 225 + i * 54));
    g.drawImage(img, (W - 600) / 2, 330, 600, 600);
    g.fillStyle = '#6f6480'; g.font = '500 28px "PingFang SC", sans-serif'; g.fillText('微信扫码填写报名信息', W / 2, 995);
    g.fillStyle = '#a094b0'; g.font = '600 20px Inter, sans-serif'; g.fillText('SCAN TO REGISTER', W / 2, 1035);
    c.toBlob(b => { if (b) save(`${form.title}-二维码.png`, b, 'image/png'); }, 'image/png');
  };
  return <section className="glass panel fa-share">
    <div className="fa-share-main">
      <div className={'fa-open' + (form.open ? ' is-open' : '')}><div>{form.open ? <Check size={18} /> : <Lock size={18} />}<span><b>{form.open ? '正在收集' : '已关闭收集'}</b><small>{form.open ? '学生可通过链接或二维码提交' : '打开后学生才能提交'}</small></span></div><Switch checked={form.open} disabled={busy} onCheckedChange={toggleOpen} aria-label="开放收集" /></div>
      <label className="form-field"><span><Link2 size={14} /> 公开链接（无需登录）</span><div className="fa-link"><input className="input mono" readOnly value={url} onFocus={e => e.currentTarget.select()} /><button className="secondary compact" onClick={copy}><Copy size={15} />复制</button><a className="secondary compact" href={url} target="_blank" rel="noreferrer"><ExternalLink size={15} />预览</a></div></label>
      <p className="fa-hint">链接与二维码在微信内可直接打开。共收到 <b>{form.counts.total}</b> 份，待分配 <b>{form.counts.pending}</b> 份。未分配的填写记录只有超级管理员可见。</p>
    </div>
    <div className="fa-qr">{qr ? <img src={qr} alt={'二维码：' + form.title} width={220} height={220} /> : <QrCode size={64} />}<button className="primary compact" onClick={downloadPng} disabled={!qr}><Download size={15} />下载二维码 PNG</button></div>
  </section>;
}
