'use client';
/**
 * 销售工作台: four animated module tiles (火热招募中 / 我的项目营收 / 进行中的学生 / 快速查找资料).
 * Mobile first: one column of big tiles and bottom-sheet panels on phones; 2×2 grid and a centred
 * panel that grows out of the tapped tile on desktop. All figures come from live data; gaps show empty states.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Flame, CircleDollarSign, UserRoundCheck, FolderSearch, ChevronRight, ChevronLeft, X, Users, CalendarDays, ExternalLink, FileText, Image as ImageIcon, Search, Eye, EyeOff } from 'lucide-react';
import { useNexus, useVisible, type FileRecord } from '@/lib/nexus/store';
import { api } from '@/lib/nexus/api';
import { assetUrl } from '@/lib/nexus/assets';
import { occurrences } from '@/lib/nexus/schedule';
import { priceFromArticle, projectRecruitment, sortRecruitment, salesOwns, inactiveEnrollment, isPseudoTeam, type SalesTeam, type ProjectRecruitment, type ProgramTarget, sheetRecruiting } from '@/lib/nexus/sales';
import type { Program } from '@/lib/nexus/data';
import { ProgramMark, Badge } from './ui';
import { greeting } from './recruitment';

type Panel = 'recruit' | 'revenue' | 'active' | 'files';
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animated count-up (ease-out cubic). */
function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now(), a = from.current, dur = reduced() ? 0 : ms;
    let raf = 0;
    const tick = (t: number) => { const k = dur ? Math.min(1, (t - start) / dur) : 1, e = 1 - Math.pow(1 - k, 3); setV(a + (target - a) * e); if (k < 1) raf = requestAnimationFrame(tick); else from.current = target; };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
function CountUp({ value, format = (n: number) => Math.round(n).toLocaleString('zh-CN') }: { value: number; format?: (n: number) => string }) {
  const v = useCountUp(value);
  return <>{format(v)}</>;
}
/** Progress ring; animates its stroke on mount / value change. */
function Ring({ value, size = 64, stroke = 7, label }: { value: number; size?: number; stroke?: number; label?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(Math.max(0, Math.min(100, value)))); return () => cancelAnimationFrame(id); }, [value]);
  return <span className="sh-ring" style={{ width: size, height: size }}>
    <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="sh-ring-track" /><circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="sh-ring-bar" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} /></svg>
    {label != null && <span className="sh-ring-label">{label}</span>}
  </span>;
}
function Bar({ value }: { value: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setW(Math.max(0, Math.min(100, value)))); return () => cancelAnimationFrame(id); }, [value]);
  return <span className="sh-bar" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: w + '%' }} /></span>;
}
const money = (n: number) => '¥' + Math.round(n).toLocaleString('zh-CN');
const moneyShort = (n: number) => n >= 10000 ? '¥' + (n / 10000).toFixed(n >= 100000 ? 0 : 1) + '万' : money(n);

/** Panel shell: bottom sheet on phones, centred card growing from the tile on desktop. */
function SheetPanel({ open, onClose, origin, title, sub, back, children }: { open: boolean; onClose: () => void; origin: { x: number; y: number } | null; title: ReactNode; sub?: ReactNode; back?: () => void; children: ReactNode }) {
  const style = origin ? { '--sh-ox': origin.x + 'px', '--sh-oy': origin.y + 'px' } as CSSProperties : undefined;
  return <DialogPrimitive.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="sh-overlay" />
      <DialogPrimitive.Content className="sh-panel" style={style} aria-describedby={undefined}>
        <span className="sh-grabber" aria-hidden="true" />
        <header className="sh-panel-head">
          {back ? <button type="button" className="sh-icon-btn" onClick={back} aria-label="返回上一级"><ChevronLeft size={20} /></button> : <span className="sh-icon-spacer" />}
          <div className="sh-panel-title"><DialogPrimitive.Title asChild><h2>{title}</h2></DialogPrimitive.Title>{sub && <p>{sub}</p>}</div>
          <DialogPrimitive.Close className="sh-icon-btn" aria-label="关闭"><X size={20} /></DialogPrimitive.Close>
        </header>
        <div className="sh-panel-body">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
function Empty({ icon: Icon, title, text }: { icon: React.ComponentType<{ size?: number }>; title: string; text?: string }) {
  return <div className="sh-empty"><span><Icon size={22} /></span><strong>{title}</strong>{text && <p>{text}</p>}</div>;
}

/* ---------------- 火热招募中 ---------------- */
type Level = { kind: 'list' } | { kind: 'project'; id: string } | { kind: 'team'; id: string };
function RecruitPanel({ programs, rows, teams, level, go, showEnded, setShowEnded }: {
  programs: Program[]; rows: ProjectRecruitment[]; teams: SalesTeam[] | null; level: Level; go: (l: Level, dir: 1 | -1) => void; showEnded: boolean; setShowEnded: (v: boolean) => void;
}) {
  const s = useNexus();
  const prog = (id: string) => programs.find(p => p.id === id);
  if (!teams) return <div className="sh-loading"><span /><span /><span /></div>;
  if (level.kind === 'list') {
    const list = rows.filter(r => showEnded || r.recruiting).sort(sortRecruitment);
    const ended = rows.filter(r => !r.recruiting).length;
    return <>
      <div className="sh-toolbar"><span>{list.length} 个项目 · 按剩余名额从多到少</span>
        {ended > 0 && <button type="button" className="sh-toggle" aria-pressed={showEnded} onClick={() => setShowEnded(!showEnded)}>{showEnded ? <EyeOff size={15} /> : <Eye size={15} />}{showEnded ? '隐藏已结束' : `显示已结束（${ended}）`}</button>}
      </div>
      {list.length ? <ul className="sh-list">{list.map((r, i) => { const p = prog(r.program); if (!p) return null; return <li key={r.program} style={{ '--i': i } as CSSProperties}>
        <button type="button" className="sh-row" onClick={() => go({ kind: 'project', id: r.program }, 1)}>
          <ProgramMark program={p} small />
          <span className="sh-row-main"><strong>{p.name}</strong>
            <small>{r.teams ? <>已报 <b>{r.enrolled}</b> / {r.capacity} 人 · {r.teams} 支队伍{r.unknownTeams ? ` · ${r.unknownTeams} 支名额待定` : ''}</> : '暂无开班队伍'}</small>
            {r.teams > 0 && <Bar value={r.progress} />}
          </span>
          <span className="sh-row-side"><b className={r.remaining ? 'sh-hot' : ''}>{r.remaining}</b><small>剩余名额</small>{!r.recruiting && <Badge tone="neutral">{r.status}</Badge>}</span>
          <ChevronRight size={18} className="sh-chev" />
        </button></li>; })}</ul>
        : <Empty icon={Flame} title="暂无招募中的项目" text="项目状态为招生中 / 滚动招生 / 预报名时会出现在这里。" />}
    </>;
  }
  if (level.kind === 'project') {
    const p = prog(level.id); const r = rows.find(x => x.program === level.id);
    const list = teams.filter(t => t.program === level.id).sort((a, b) => Number(sheetRecruiting(b.recruitStatus) !== false) - Number(sheetRecruiting(a.recruitStatus) !== false) || ((b.capacity ?? b.enrolled) - b.enrolled) - ((a.capacity ?? a.enrolled) - a.enrolled) || a.name.localeCompare(b.name, 'zh-CN'));
    return <>
      {p && r && <div className="sh-hero"><Ring value={r.progress} size={78} label={<><b>{r.progress}%</b><small>完成度</small></>} /><div><span className="sh-eyebrow">{p.short} · {r.status}</span><h3>{p.name}</h3><p>已报 {r.enrolled} / {r.capacity} 人 · 剩余 <b>{r.remaining}</b> 个名额</p></div></div>}
      {list.length ? <ul className="sh-list">{list.map((t, i) => { const pct = t.capacity ? Math.min(100, Math.round(t.enrolled / t.capacity * 100)) : 0; const left = t.capacity != null ? Math.max(0, t.capacity - t.enrolled) : null; return <li key={t.id} style={{ '--i': i } as CSSProperties}>
        <button type="button" className="sh-row" onClick={() => go({ kind: 'team', id: t.id }, 1)}>
          <span className="sh-team-dot"><Users size={17} /></span>
          <span className="sh-row-main"><strong>{t.name}</strong><small>{t.teacher || '授课老师待定'} · 已报 <b>{t.enrolled}</b>{t.capacity != null ? ` / ${t.capacity}` : ''} 人{t.classType ? ` · ${t.classType.replace(/^\d+\.\s*/, '')}` : ''}</small>{t.capacity != null && <Bar value={pct} />}</span>
          <span className="sh-row-side">{left != null ? <><b className={left ? 'sh-hot' : ''}>{left}</b><small>剩余</small></> : <small className="sh-pending">名额待定</small>}{t.recruitStatus && <Badge tone={sheetRecruiting(t.recruitStatus) === false ? 'neutral' : t.recruitStatus.includes('火热') ? 'pink' : 'green'}>{t.recruitStatus}</Badge>}</span>
          <ChevronRight size={18} className="sh-chev" />
        </button></li>; })}</ul>
        : <Empty icon={Users} title="该项目暂无开班队伍" text="运营在队伍管理中建队后，这里会显示每支队伍的招募进度。" />}
      <button type="button" className="sh-link" onClick={() => s.go('programs/' + level.id)}>查看项目书与资料<ChevronRight size={15} /></button>
    </>;
  }
  const t = teams.find(x => x.id === level.id);
  if (!t) return <Empty icon={Users} title="队伍不存在" />;
  return <TeamDetail team={t} program={prog(t.program)} />;
}
function TeamDetail({ team, program }: { team: SalesTeam; program?: Program }) {
  const s = useNexus();
  const article = s.articles.find(a => a.program === team.program)?.published;
  const poster = team.posterUrl || article?.cover || (program ? assetUrl(`materials/poster-${program.id}.svg`) : '');
  const schedule = (article?.blocks || []).filter(b => b.type === 'highlight' && b.kind === 'schedule').flatMap(b => b.type === 'highlight' ? b.items : []).filter(i => i.label && i.value);
  const courses = s.courses.filter(c => c.team === team.id);
  const occ = occurrences(courses, s.courseSessions);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = occ.filter(o => o.date >= today);
  const shown = (upcoming.length ? upcoming : occ).slice(0, 8);
  const left = team.capacity != null ? Math.max(0, team.capacity - team.enrolled) : null;
  const [posterBroken, setPosterBroken] = useState(false);
  return <div className="sh-team">
    <div className="sh-hero"><Ring value={team.capacity ? team.enrolled / team.capacity * 100 : 0} size={78} label={<><b>{team.enrolled}</b><small>{team.capacity != null ? `/ ${team.capacity} 人` : '人'}</small></>} />
      <div><span className="sh-eyebrow">{program?.name || team.program}</span><h3>{team.name}</h3><p>{team.teacher || '授课老师待定'} · {left != null ? <>剩余 <b>{left}</b> 个名额</> : '名额待定'}</p></div></div>
    <section className="sh-section"><h4><Users size={16} />队员 · {team.enrolled} 人</h4>
      {team.members.length ? <ul className="sh-members">{team.members.map(m => <li key={m.id}><button type="button" onClick={() => s.go('students/' + m.id)}><span className="avatar">{m.name.slice(0, 1)}</span><span><strong>{m.name}</strong><small>{[m.grade, m.school].filter(Boolean).join(' · ') || '—'}</small></span><Badge tone={m.health === '状态不佳' ? 'pink' : m.health === '需关注' ? 'orange' : 'green'}>{m.status}</Badge><ChevronRight size={16} /></button></li>)}</ul> : null}
      {team.hiddenMembers > 0 && <p className="sh-note">另有 {team.hiddenMembers} 位队员由其他顾问负责，姓名与档案已隐藏。</p>}
      {!team.enrolled && <p className="sh-note">本队伍暂未有报名成员。</p>}
    </section>
    <section className="sh-section"><h4><ImageIcon size={16} />{team.posterUrl ? '课题海报' : '项目海报'}</h4>
      {poster && !posterBroken ? <a className="sh-poster" href={poster} target="_blank" rel="noopener noreferrer"><img src={poster} alt={`${program?.name || ''} 海报`} loading="lazy" onError={() => setPosterBroken(true)} /><span><ExternalLink size={14} />查看大图</span></a> : <p className="sh-note">该项目尚未上传海报。</p>}
    </section>
    <section className="sh-section"><h4><CalendarDays size={16} />课程计划</h4>
      {team.scheduleUrl && <a className="sh-poster sh-schedule-img" href={team.scheduleUrl} target="_blank" rel="noopener noreferrer"><img src={team.scheduleUrl} alt={`${team.name} 课程计划`} loading="lazy" /><span><ExternalLink size={14} />查看课表大图</span></a>}
      {shown.length ? <ul className="sh-sessions">{shown.map(o => <li key={o.key}><time>{o.date.slice(5).replace('-', '/')}</time><span><strong>{o.start}{o.end ? '–' + o.end : ''}</strong><small>{o.course.name}{o.location ? ' · ' + o.location : ''}</small></span></li>)}</ul> : null}
      {occ.length > shown.length && <p className="sh-note">共 {occ.length} 节，显示{upcoming.length ? '接下来' : '最近'}的 {shown.length} 节。</p>}
      {schedule.length > 0 && <dl className="sh-facts">{schedule.map(i => <div key={i.label}><dt>{i.label}</dt><dd>{i.value}</dd></div>)}</dl>}
      {!shown.length && !schedule.length && !team.scheduleUrl && <p className="sh-note">尚未排课，项目书中也没有时间安排。</p>}
    </section>
  </div>;
}

/* ---------------- tiles ---------------- */
function Tile({ id, tone, icon: Icon, title, kicker, value, unit, foot, visual, onOpen, delay }: { id: Panel; tone: string; icon: React.ComponentType<{ size?: number }>; title: string; kicker: string; value: ReactNode; unit?: string; foot: ReactNode; visual?: ReactNode; onOpen: (id: Panel, el: HTMLElement) => void; delay: number }) {
  return <button type="button" className={'sh-tile glass ' + tone} style={{ '--d': delay + 'ms' } as CSSProperties} onClick={e => onOpen(id, e.currentTarget)} aria-haspopup="dialog">
    <span className="sh-tile-glow" aria-hidden="true" />
    <span className="sh-tile-top"><span className="sh-tile-icon"><Icon size={20} /></span><span className="sh-tile-kicker">{kicker}</span><ChevronRight size={18} className="sh-tile-arrow" /></span>
    <span className="sh-tile-body"><span><span className="sh-tile-title">{title}</span><span className="sh-tile-value">{value}{unit && <small>{unit}</small>}</span></span>{visual}</span>
    <span className="sh-tile-foot">{foot}</span>
  </button>;
}

export default function SalesHome() {
  const s = useNexus(), v = useVisible();
  const [apiTeams, setApiTeams] = useState<SalesTeam[] | null>(null);
  const [apiFailed, setApiFailed] = useState(false);
  const [targets, setTargets] = useState<ProgramTarget[]>([]);
  const [open, setOpen] = useState<Panel | null>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [level, setLevel] = useState<Level>({ kind: 'list' });
  const [dir, setDir] = useState<1 | -1>(1);
  const [showEnded, setShowEnded] = useState(false);
  const [q, setQ] = useState('');
  const myName = s.user?.name, mySalesName = s.user?.salesName;
  // Preview build (or API failure): seats from local data; no class-type capacity there, so 名额待定.
  const localTeams = useMemo<SalesTeam[]>(() => s.teams.filter(t => !isPseudoTeam(t.name)).map(t => {
    const ids = new Set(s.enrollments.filter(e => e.team === t.id && !inactiveEnrollment(e.status)).map(e => e.student));
    const members = s.students.filter(x => ids.has(x.id) && salesOwns(x.sales, { name: myName, salesName: mySalesName }));
    return { id: t.id, program: t.program, name: t.name, teacher: t.teacher, enrolled: ids.size, capacity: null, classType: null, members: members.map(x => ({ id: x.id, name: x.name, grade: x.grade, status: x.status, health: x.health, school: x.profile?.school || '' })), hiddenMembers: ids.size - members.length };
  }), [s.teams, s.enrollments, s.students, myName, mySalesName]);
  useEffect(() => {
    if (!s.apiMode) return;
    let alive = true;
    api.salesRecruitment().then(r => { if (alive) { setApiTeams(r.teams); setTargets(r.programs || []); } }).catch(() => { if (alive) setApiFailed(true); });
    return () => { alive = false; };
  }, [s.apiMode, s.teams, s.enrollments]);
  const teams = !s.apiMode || apiFailed ? localTeams : apiTeams;

  const rows = useMemo(() => teams ? projectRecruitment(s.programs, teams, s.apiMode && !apiFailed ? targets : []) : [], [teams, s.programs, targets, s.apiMode, apiFailed]);
  const recruiting = rows.filter(r => r.recruiting);
  const totals = recruiting.reduce((a, r) => ({ enrolled: a.enrolled + r.enrolled, capacity: a.capacity + r.capacity, remaining: a.remaining + r.remaining }), { enrolled: 0, capacity: 0, remaining: 0 });
  const recruitPct = totals.capacity ? Math.round(totals.enrolled / totals.capacity * 100) : 0;

  const mine = v.students.filter(x => !inactiveEnrollment(x.status));
  const revenue = useMemo(() => {
    const by = new Map<string, number>();
    for (const x of mine) by.set(x.program, (by.get(x.program) || 0) + 1);
    const lines = [...by.entries()].map(([program, count]) => { const price = priceFromArticle(s.articles.find(a => a.program === program)?.published); return { program, count, price, total: price.fee * count }; }).sort((a, b) => b.total - a.total || b.count - a.count);
    return { lines, total: lines.reduce((n, l) => n + l.total, 0), pending: lines.filter(l => l.price.pending).length };
  }, [mine, s.articles]);
  const active = v.students.filter(x => x.status === '进行中');
  const activeBy = useMemo(() => { const m = new Map<string, typeof active>(); for (const x of active) m.set(x.program, [...(m.get(x.program) || []), x]); return [...m.entries()].sort((a, b) => b[1].length - a[1].length); }, [active]);
  const files = v.files;
  const fileGroups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = (f: FileRecord) => !needle || (f.name + f.type + (s.programs.find(p => p.id === f.program)?.name || '') + (s.resourceFolders.find(x => x.id === f.folder)?.name || '')).toLowerCase().includes(needle);
    const m = new Map<string, FileRecord[]>();
    for (const f of files.filter(hit)) { const folder = s.resourceFolders.find(x => x.id === f.folder); const key = (s.programs.find(p => p.id === f.program)?.name || '其他') + (folder ? ' · ' + folder.name : ''); m.set(key, [...(m.get(key) || []), f]); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));
  }, [files, q, s.programs, s.resourceFolders]);

  const openPanel = (id: Panel, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setOrigin({ x: r.left + r.width / 2 - window.innerWidth / 2, y: r.top + r.height / 2 - window.innerHeight / 2 });
    setLevel({ kind: 'list' }); setDir(1); setOpen(id);
  };
  const go = (l: Level, d: 1 | -1) => { setDir(d); setLevel(l); };
  const back = level.kind === 'team' ? () => { const t = teams?.find(x => x.id === level.id); go(t ? { kind: 'project', id: t.program } : { kind: 'list' }, -1); } : level.kind === 'project' ? () => go({ kind: 'list' }, -1) : undefined;
  const levelKey = level.kind === 'list' ? 'list' : level.kind + ':' + level.id;
  const titleFor = () => {
    if (open === 'recruit') { if (level.kind === 'project') return s.programs.find(p => p.id === level.id)?.name || '项目'; if (level.kind === 'team') return teams?.find(t => t.id === level.id)?.name || '队伍'; return '火热招募中'; }
    return open === 'revenue' ? '我的项目营收' : open === 'active' ? '进行中的学生' : '快速查找资料';
  };
  const subFor = () => open === 'recruit' ? (level.kind === 'list' ? '按项目汇总所有队伍的招募进度' : level.kind === 'project' ? '各队伍招募进度 · 点按查看队员与课程' : '队员 · 海报 · 课程计划')
    : open === 'revenue' ? '学生人数 × 项目单价（单价待定按 0 计）' : open === 'active' ? '按项目分组 · 点按查看学生档案' : '资料中心 · 销售可见的资料';

  return <div className="sales-home">
    <div className="welcome sales-welcome"><div><div className="eyebrow">SALES WORKSPACE</div><h1>{greeting()}，{s.user?.name || '销售顾问'} <span className="hello-spark">✧</span></h1><p>{mine.length ? `你负责的 ${mine.length} 位学生 · ${recruiting.length} 个项目正在招募` : '今天也一起把好项目推荐给合适的学生。'}</p></div></div>
    <div className="sh-grid">
      <Tile id="recruit" tone="sh-blue" icon={Flame} kicker="RECRUITING" title="火热招募中" delay={0} onOpen={openPanel}
        value={teams ? <CountUp value={totals.remaining} /> : '—'} unit="个剩余名额"
        visual={<Ring value={recruitPct} size={76} label={<><b><CountUp value={recruitPct} />%</b><small>已报满</small></>} />}
        foot={teams ? <>{recruiting.length} 个项目招募中 · 已报 {totals.enrolled} / {totals.capacity} 人</> : '正在汇总招募进度…'} />
      <Tile id="revenue" tone="sh-indigo" icon={CircleDollarSign} kicker="MY REVENUE" title="我的项目营收" delay={70} onOpen={openPanel}
        value={<CountUp value={revenue.total} format={moneyShort} />}
        visual={<span className="sh-spark" aria-hidden="true">{revenue.lines.slice(0, 5).map((l, i) => <i key={l.program} style={{ '--h': Math.max(14, Math.round(l.count / Math.max(1, ...revenue.lines.map(x => x.count)) * 100)) + '%', '--i': i } as CSSProperties} />)}</span>}
        foot={<>{mine.length} 位学生 · {revenue.lines.length} 个项目{revenue.pending ? ` · ${revenue.pending} 个单价待定` : ''}</>} />
      <Tile id="active" tone="sh-teal" icon={UserRoundCheck} kicker="IN PROGRESS" title="进行中的学生" delay={140} onOpen={openPanel}
        value={<CountUp value={active.length} />} unit="位"
        visual={<span className="sh-avatars" aria-hidden="true">{active.slice(0, 4).map((x, i) => <i key={x.id} style={{ '--i': i } as CSSProperties}>{x.name.slice(0, 1)}</i>)}{active.length > 4 && <i className="more">+{active.length - 4}</i>}</span>}
        foot={active.length ? <>分布在 {activeBy.length} 个项目</> : '暂无进行中的学生'} />
      <Tile id="files" tone="sh-sky" icon={FolderSearch} kicker="QUICK FIND" title="快速查找资料" delay={210} onOpen={openPanel}
        value={<CountUp value={files.length} />} unit="份资料"
        visual={<span className="sh-search-hint"><Search size={16} />搜索</span>}
        foot={files.length ? <>{new Set(files.map(f => f.program)).size} 个项目的资料</> : '资料中心暂无销售可见的资料'} />
    </div>
    <footer className="page-footer"><span>B.E.S.T · Innovation, connected.</span><span>{s.apiMode ? '实时数据' : '预览站 · 数据保存在本浏览器'}</span></footer>

    <SheetPanel open={!!open} onClose={() => setOpen(null)} origin={origin} title={titleFor()} sub={subFor()} back={open === 'recruit' ? back : undefined}>
      <div key={open + ':' + levelKey} className={'sh-stage ' + (dir > 0 ? 'in-fwd' : 'in-back')}>
        {open === 'recruit' && <RecruitPanel programs={s.programs} rows={rows} teams={teams} level={level} go={go} showEnded={showEnded} setShowEnded={setShowEnded} />}
        {open === 'revenue' && <>
          <div className="sh-hero sh-hero-money"><div><span className="sh-eyebrow">合计营收</span><h3 className="sh-money"><CountUp value={revenue.total} format={money} /></h3><p>{mine.length} 位学生{revenue.pending ? ` · ${revenue.pending} 个项目单价待定（按 ¥0 计）` : ''}</p></div></div>
          {revenue.lines.length ? <ul className="sh-list">{revenue.lines.map((l, i) => { const p = s.programs.find(x => x.id === l.program); const share = revenue.total ? l.total / revenue.total * 100 : 0; return <li key={l.program} style={{ '--i': i } as CSSProperties}><div className="sh-row static">
            {p ? <ProgramMark program={p} small /> : <span className="sh-team-dot"><FileText size={16} /></span>}
            <span className="sh-row-main"><strong>{p?.name || l.program}</strong><small>{l.count} 位 × {l.price.pending ? <em className="sh-pending">单价待定</em> : l.price.label}</small>{revenue.total > 0 && <Bar value={share} />}</span>
            <span className="sh-row-side"><b>{money(l.total)}</b>{l.price.pending && <Badge tone="orange">待定</Badge>}</span>
          </div></li>; })}</ul> : <Empty icon={CircleDollarSign} title="还没有你负责的学生" text="运营在学生档案中把「负责销售」设为你后，营收会按项目单价自动汇总。" />}
          <p className="sh-note">项目单价取自项目中心「项目书」的项目参考价；标注「演示」或「待定」的价格不计入营收。</p>
        </>}
        {open === 'active' && (activeBy.length ? activeBy.map(([program, list], gi) => { const p = s.programs.find(x => x.id === program); return <section key={program} className="sh-group" style={{ '--i': gi } as CSSProperties}>
          <h4>{p ? <ProgramMark program={p} small /> : null}<span>{p?.name || program}</span><em>{list.length} 位</em></h4>
          <ul className="sh-members">{list.map(x => <li key={x.id}><button type="button" onClick={() => { setOpen(null); s.go('students/' + x.id); }}><span className="avatar">{x.name.slice(0, 1)}</span><span><strong>{x.name}</strong><small>{[x.grade, s.teams.find(t => t.id === x.team)?.name].filter(Boolean).join(' · ') || '—'}</small></span><Badge tone={x.health === '状态不佳' ? 'pink' : x.health === '需关注' ? 'orange' : 'green'}>{x.health || x.status}</Badge><ChevronRight size={16} /></button></li>)}</ul>
        </section>; }) : <Empty icon={UserRoundCheck} title="暂无进行中的学生" text="你负责的学生进入「进行中」状态后会出现在这里。" />)}
        {open === 'files' && <>
          <label className="sh-search"><Search size={18} /><input type="search" inputMode="search" enterKeyHint="search" placeholder="搜索资料、项目或文件夹" value={q} onChange={e => setQ(e.target.value)} aria-label="搜索资料" /></label>
          {fileGroups.length ? fileGroups.map(([group, list], gi) => <section key={group} className="sh-group" style={{ '--i': gi } as CSSProperties}><h4><span>{group}</span><em>{list.length}</em></h4>
            <ul className="sh-files">{list.map(f => { const url = f.url || assetUrl(`materials/${f.file ?? `${f.id}.${f.format === 'SVG' ? 'svg' : 'pdf'}`}`); return <li key={f.id}><a href={url} target="_blank" rel="noopener noreferrer"><span className={'sh-file-icon ' + (f.format === 'PDF' ? 'pdf' : 'img')}><FileText size={18} /><small>{f.format}</small></span><span><strong>{f.name}</strong><small>{f.type} · {f.size}</small></span><ExternalLink size={16} /></a></li>; })}</ul></section>)
            : files.length ? <Empty icon={Search} title="没有匹配的资料" text="换个关键词试试。" /> : <Empty icon={FolderSearch} title="资料中心暂无可用资料" text="运营上传并设为「销售可见」后，可在这里一键打开。" />}
          <button type="button" className="sh-link" onClick={() => { setOpen(null); s.go('resources'); }}>前往资料中心<ChevronRight size={15} /></button>
        </>}
      </div>
    </SheetPanel>
  </div>;
}
