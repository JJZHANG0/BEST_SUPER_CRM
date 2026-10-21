'use client';
import { useRef, useState, type CSSProperties } from 'react';
import { Users, CalendarDays, GraduationCap, ClipboardList, ChevronRight, Download, Eye, Copy, Maximize2, X, Image as ImageIcon, UserPlus } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useNexus } from '@/lib/nexus/store';
import { cohortOffers, offerFor, cohortAvailability, priceText, planText } from '@/lib/nexus/recruitment';
import { assetUrl } from '@/lib/nexus/assets';
import { Badge, ProgramMark, SearchBox, Choice, Meter, NoResults, SectionTitle, EmptyState } from './ui';
import type { Team, Course } from '@/lib/nexus/data';
import { salesOwns } from '@/lib/nexus/sales';
import { occurrences } from '@/lib/nexus/schedule';
export const greeting=()=>{const h=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',hour:'numeric',hourCycle:'h23'}).format(new Date()));return h<11?'早上好':h<14?'中午好':h<18?'下午好':'晚上好'};

export function Poster({program,src:custom,label}:{program:string;src?:string|null;label?:string}) {
  const {programs}=useNexus();const [open,setOpen]=useState(false);
  const p=programs.find(x=>x.id===program)!;
  const src=custom||assetUrl(`materials/poster-${program}.svg`);
  return <>
    <button className="secondary" onClick={()=>setOpen(true)}><Eye size={17}/>{label||'查看招生海报'}</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="file-preview">
      <DialogTitle>{p.name} · 招生海报</DialogTitle><DialogDescription>{custom?'队伍课题海报 · 长按或下载保存':'项目与价格信息以正式发布版本为准。'}</DialogDescription>
      <img className="preview-image" src={src} alt={`${p.name}招生海报`}/>
      <a className="primary" href={src} download={custom?`${p.short}-课题海报.jpg`:`${p.short}-招生海报.svg`} onClick={e=>{if(/MicroMessenger/i.test(navigator.userAgent)){e.preventDefault();toast.info('请在微信右上角菜单选择在浏览器中打开，再下载海报。')}}}><Download size={17}/>下载海报</a>
    </DialogContent></Dialog>
  </>;
}
function SalesCohortDialog({team,open,onOpenChange}:{team:Team|null;open:boolean;onOpenChange:(open:boolean)=>void}) {
  const s=useNexus();
  if(!team)return null;
  const p=s.programs.find(p=>p.id===team.program)!;
  const offer=offerFor(p.id),cohort=cohortOffers[team.id],a=cohortAvailability(team,s.enrollments);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sales-cohort-dialog">
    <DialogTitle className="sr-only">{p.name} · {team.name}招生详情</DialogTitle>
    <DialogDescription className="sr-only">查看项目招生进度、剩余名额、价格与开课信息。</DialogDescription>
    <div className="sales-modal-hero"><ProgramMark program={p}/><div><span>{offer.code} · {team.id}</span><h2>{p.name}</h2><p>{team.name}</p></div><Badge tone={a.status==='招生中'?'green':'neutral'}>{a.status}</Badge></div>
    <div className="sales-modal-metrics"><div><span>招生进度</span><b>{a.confirmed}<small> / {a.capacity} 人</small></b></div><div><span>剩余名额</span><b>{a.remaining}<small> 个</small></b></div><div><span>项目单价</span><b>{priceText(offer.fee)}{offer.fee>0&&<small> / 人</small>}</b></div></div>
    <div className="sales-modal-progress"><div><span>当前招生完成度</span><b>{a.progress}%</b></div><Meter value={a.progress}/></div>
    <dl className="sales-detail-grid"><div><dt>计划开课</dt><dd>{cohort?.opens||'待安排'}</dd></div><div><dt>报名截止</dt><dd>{cohort?.deadline||'待发布'}</dd></div><div><dt>授课老师</dt><dd>{team.teacher}</dd></div><div><dt>运营对接</dt><dd>{offer.operations||'待指定'}</dd></div><div><dt>上课时间</dt><dd>{cohort?.schedule||'待安排'}</dd></div><div><dt>课程计划</dt><dd>{planText(offer)}</dd></div></dl>
    <p className="sales-price-note">{offer.feeNote}</p>
    <div className="sales-modal-actions"><Poster program={team.program} src={team.posterUrl} label={team.posterUrl?'查看课题海报':undefined}/><button className="primary" onClick={()=>{onOpenChange(false);s.go('programs/'+team.program)}}>查看项目资料<ChevronRight size={16}/></button></div>
  </DialogContent></Dialog>;
}
export function CohortCard({team}:{team:Team}) {
  const [open,setOpen]=useState(false);
  const s=useNexus(),p=s.programs.find(p=>p.id===team.program)!,offer=offerFor(p.id),cohort=cohortOffers[team.id];
  const a=cohortAvailability(team,s.enrollments);
  return <><article className="glass admission-card">
    <div className="card-top"><ProgramMark program={p} small/><Badge tone={a.status==='招生中'?'green':'neutral'}>{a.status}</Badge></div>
    <button className="admission-heading" onClick={()=>setOpen(true)}><h2>{team.name}</h2><ChevronRight size={19}/></button>
    <p className="admission-program">{p.name}</p><div className="admission-code">{offer.code} · {team.id}</div>
    <div className="admission-numbers"><span>已报名 <b>{a.confirmed}</b> / {a.capacity} 人</span><strong>{a.status==='招生中'?`剩余 ${a.remaining} 个名额`:a.status==='筹备中'?'尚未开放报名':a.status==='已满员'?'暂无名额':'本期已截止'}</strong></div>
    <Meter value={a.progress}/>
    <dl className="admission-facts"><div><dt><GraduationCap size={15}/>授课老师</dt><dd>{team.teacher}</dd></div><div><dt><ClipboardList size={15}/>运营对接</dt><dd>{offer.operations||'待指定'}</dd></div><div><dt><CalendarDays size={15}/>计划开课</dt><dd>{cohort?.opens||'待安排'}</dd></div><div><dt>课程计划</dt><dd>{planText(offer)}</dd></div></dl>
    <div className="admission-price"><strong>{priceText(offer.fee)}{offer.fee>0&&<small> / 人</small>}</strong></div>
    <button className="card-link" onClick={()=>setOpen(true)}>查看招生与队伍详情<ChevronRight size={16}/></button>
  </article><SalesCohortDialog team={team} open={open} onOpenChange={setOpen}/></>;
}
export function CohortGrid({program,limit}:{program?:string;limit?:number}) {
  const s=useNexus();let teams=s.teams.filter(t=>!program||t.program===program);if(limit)teams=teams.slice(0,limit);
  return <div className="admission-grid">{teams.map(t=><CohortCard key={t.id} team={t}/>)}</div>;
}
export function RecruitmentHub() {
  const s=useNexus();const [q,setQ]=useState(''),[status,setStatus]=useState('全部招生状态'),[project,setProject]=useState(s.programs.find(p=>p.id===new URLSearchParams(s.route.split('?')[1]).get('program'))?.name||'全部项目');
  const list=s.teams.filter(t=>{const p=s.programs.find(p=>p.id===t.program)!;return (p.name+t.name+offerFor(p.id).code+t.id).toLowerCase().includes(q.toLowerCase())&&(project==='全部项目'||p.name===project)&&(status==='全部招生状态'||cohortAvailability(t,s.enrollments).status===status)});
  return <>
    <div className="page-title"><div><div className="eyebrow">COHORTS & ADMISSIONS</div><h1>开班队伍与招生</h1><p>先看名额、排期与价格，再匹配合适的学生。</p></div></div>
    <div className="filter-toolbar admission-filters"><SearchBox value={q} onChange={setQ} placeholder="搜索项目、队伍或编号"/><Choice label="项目筛选" value={project} onChange={setProject} options={['全部项目',...s.programs.map(p=>p.name)]}/><Choice label="招生状态筛选" value={status} onChange={setStatus} options={['全部招生状态','招生中','已满员','已截止','筹备中']}/></div>
    <div className="results-meta">{list.length} 支队伍<span>剩余名额根据当前有效报名记录计算</span></div>
    <div className="admission-grid">{list.map(t=><CohortCard key={t.id} team={t}/>)}</div>{!list.length&&<NoResults/>}
  </>;
}
export function ProgramOfferSummary({program}:{program:string}) {
  const s=useNexus(),offer=offerFor(program);const teams=s.teams.filter(t=>t.program===program);
  const remaining=teams.reduce((n,t)=>{const a=cohortAvailability(t,s.enrollments);return n+(a.status==='招生中'?a.remaining:0)},0);
  return <section className="glass panel offer-summary"><div className="section-title"><div><h2>招生信息速览</h2><span>未填写的项显示为待定</span></div><Badge tone="violet">{offer.code}</Badge></div>
    <div className="offer-metrics"><div><span>项目参考价</span><b>{priceText(offer.fee)}{offer.fee>0&&<small> / 人</small>}</b></div><div><span>当前可报余位</span><b>{remaining}<small> 个</small></b></div><div><span>课程计划</span><b>{planText(offer)}</b></div></div>
    <dl className="info-grid"><div><dt>运营对接人</dt><dd>{offer.operations||'待指定'}</dd></div><div><dt>适合人群</dt><dd>{offer.audience||'待补充'}</dd></div><div><dt>预期成果</dt><dd>{offer.outcome||'待补充'}</dd></div><div><dt>费用说明</dt><dd>{offer.feeNote}</dd></div></dl>
    <div className="actions"><Poster program={program}/><button className="secondary" onClick={()=>s.go('teams?program='+program)}><Users size={17}/>查看开班队伍</button></div>
  </section>;
}
/** Thumbnail → fullscreen lightbox (real <img>: iOS long-press → 存储图像). Reuses sales lightbox CSS. */
function TeamImageCard({ src, alt, label, className, onError }: { src: string; alt: string; label: string; className?: string; onError?: () => void }) {
  const [open, setOpen] = useState(false);
  const startY = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const zoomed = () => typeof window !== 'undefined' && (window.visualViewport?.scale ?? 1) > 1.05;
  return <>
    <button type="button" className={'sh-poster team-media-card ' + (className || '')} onClick={() => setOpen(true)}>
      <img src={src} alt={alt} loading="lazy" onError={onError} />
      <span><Maximize2 size={14} />{label}</span>
    </button>
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="sh-lightbox-backdrop" />
        <DialogPrimitive.Content className="sh-lightbox" aria-describedby={undefined} style={{ '--dy': dy + 'px', opacity: dy ? Math.max(0.35, 1 - dy / 400) : undefined } as CSSProperties}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          onTouchStart={e => { startY.current = e.touches.length === 1 && !zoomed() ? e.touches[0].clientY : null; }}
          onTouchMove={e => { if (startY.current == null || e.touches.length !== 1) return; setDy(Math.max(0, e.touches[0].clientY - startY.current)); }}
          onTouchEnd={() => { if (dy > 90) setOpen(false); setDy(0); startY.current = null; }}>
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="sh-lightbox-close" aria-label="关闭"><X size={22} /></DialogPrimitive.Close>
          <img src={src} alt={alt} className="sh-lightbox-img" />
          <p className="sh-lightbox-hint">双指缩放 · 长按图片可保存 · 下滑或点空白处关闭</p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  </>;
}

type TeamCourse = Pick<Course, 'id' | 'name' | 'date' | 'time' | 'teacher' | 'status' | 'code'>;

/** 招生指标 + 开班事实 + 摘要操作 — for the secondary「更多」tab (not the default first screen). */
export function TeamAdmissionPanel({ team }: { team: Team }) {
  const s = useNexus(), p = s.programs.find(p => p.id === team.program)!, offer = offerFor(p.id), cohort = cohortOffers[team.id], a = cohortAvailability(team, s.enrollments);
  const copy = async () => {
    const text = `${p.name}｜${team.name}\n项目编号：${offer.code} / ${team.id}\n招生：${a.status}，已报 ${a.confirmed}/${a.capacity} 人${a.status === '招生中' ? `，剩余 ${a.remaining} 席` : ''}\n参考价：${priceText(offer.fee)}\n计划开课：${cohort?.opens || '待安排'}\n课程：${planText(offer)}\n授课老师：${team.teacher}\n运营对接：${offer.operations || '待指定'}\n以正式报价为准。`;
    try { await navigator.clipboard.writeText(text); toast.success('招生摘要已复制'); } catch { toast.error('浏览器限制了复制，可直接选择页面文字复制。'); }
  };
  return <section className="glass panel offer-summary team-tab-panel">
    <SectionTitle title="招生与开班" sub="只读 · 招生进度 / 状态 / 参考价也可在「编辑队伍」中管理" />
    <div className="offer-metrics offer-metrics-compact" aria-label="招生指标（只读）">
      <div><span>招生进度</span><b>{a.confirmed}<small> / {a.capacity} 人</small></b></div>
      <div><span>{a.status === '招生中' ? '剩余名额' : '招生状态'}</span><b>{a.status === '招生中' ? a.remaining : a.status}</b></div>
      <div><span>项目参考价</span><b>{priceText(offer.fee)}{offer.fee > 0 && <small> / 人</small>}</b></div>
    </div>
    <Meter value={a.progress} />
    <dl className="info-grid">
      <div><dt>项目编号 / 队伍编号</dt><dd>{offer.code} / {team.id}</dd></div>
      <div><dt>运营对接人</dt><dd>{offer.operations || team.opsOwner || '待指定'}</dd></div>
      <div><dt>授课老师</dt><dd>{team.teacher || '待定'}</dd></div>
      <div><dt>老师介绍</dt><dd>{offer.teacherBio || '待补充'}</dd></div>
      <div><dt>计划开课 / 报名截止</dt><dd>{cohort?.opens || '待安排'} / {cohort?.deadline || '待发布'}</dd></div>
      <div><dt>上课时间</dt><dd>{cohort?.schedule || '待安排'}</dd></div>
      <div><dt>课程总量</dt><dd>{planText(offer)}</dd></div>
      <div><dt>费用与包含内容</dt><dd>{offer.feeNote}</dd></div>
    </dl>
    <div className="actions">
      <Poster program={team.program} src={team.posterUrl} label={team.posterUrl ? '查看课题海报' : undefined} />
      <button type="button" className="secondary" onClick={copy}><Copy size={16} />复制招生摘要</button>
      <button type="button" className="secondary" onClick={() => s.go('programs/' + team.program)}>查看完整项目与资料</button>
    </div>
  </section>;
}

/** Bound 课程管理 courses — light panel for the「课程」tab. */
export function TeamCoursesPanel({ team, courses }: { team: Team; courses?: TeamCourse[] }) {
  const s = useNexus();
  const bound = courses ?? s.courses.filter(c => c.team === team.id);
  const occ = occurrences(bound as Course[], s.courseSessions);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = occ.filter(o => o.date >= today);
  const next = upcoming[0] || occ[0];
  return <section className="glass panel course-plan team-tab-panel">
    <SectionTitle title="课程" sub="绑定自「课程管理」" action={s.role !== 'sales' ? '去课程管理' : undefined} onClick={() => s.go('courses')} />
    {next && <p className="team-next-session muted">下一节：{next.date.slice(5)} {next.start || next.course.time.split('–')[0]} · {next.course.name}</p>}
    {bound.length ? <div className="stack-list">{bound.map(c =>
      <button key={c.id} type="button" className="record-link" onClick={() => s.go('courses/' + c.id)}>
        <span className="course-time">{c.time.split('–')[0]}<small>{c.date.slice(5)}</small></span>
        <div><h3>{c.name}{c.code && <em className="course-code"> {c.code}</em>}</h3><p>{c.teacher} · {c.status}</p></div>
        <ChevronRight size={16} />
      </button>
    )}</div> : <EmptyState icon={CalendarDays} title="尚未关联课程" description="在「课程管理」中新建或编辑课程并选择本队伍。" action={s.role !== 'sales' ? '去课程管理' : undefined} onAction={() => s.go('courses')} />}
  </section>;
}

/** 海报与简介 — 课程计划图优先于招生/课题海报（与销售端产品约定一致）. */
export function TeamMediaIntro({ team, onEdit }: { team: Team; onEdit?: () => void }) {
  const s = useNexus();
  const p = s.programs.find(x => x.id === team.program);
  const offer = offerFor(team.program);
  const article = s.articles.find(a => a.program === team.program)?.published;
  const poster = team.posterUrl || article?.cover || (p ? assetUrl(`materials/poster-${p.id}.svg`) : '');
  const [posterBroken, setPosterBroken] = useState(false);
  const introBits = [p?.description, offer.audience && `适合：${offer.audience}`, offer.outcome && `预期成果：${offer.outcome}`, team.note].filter(Boolean) as string[];
  return <section className="glass panel team-tab-panel team-media-intro">
    <SectionTitle title="海报与简介" sub="课程计划图优先展示；点图可放大，长按保存" />
    <div className="team-media-stack">
      {team.scheduleUrl ? (
        <div className="team-media-block">
          <h3><CalendarDays size={15} />课程计划</h3>
          <TeamImageCard src={team.scheduleUrl} alt={`${team.name} 课程计划`} label="查看课程计划大图" className="sh-schedule-img" />
        </div>
      ) : null}
      <div className="team-media-block">
        <h3><ImageIcon size={15} />{team.posterUrl ? '课题海报' : '项目海报'}</h3>
        {poster && !posterBroken
          ? <TeamImageCard src={poster} alt={`${team.name} 海报`} label="查看大图" onError={() => setPosterBroken(true)} />
          : <p className="muted">尚未上传海报。{onEdit && s.role !== 'sales' ? '可在「编辑队伍」中上传课题海报。' : ''}</p>}
        {onEdit && s.role !== 'sales' && <button type="button" className="secondary compact" onClick={onEdit}><ImageIcon size={14} />编辑队伍 · 上传海报</button>}
      </div>
      <div className="team-media-block prose">
        <h3>项目简介</h3>
        {introBits.length ? introBits.map((t, i) => <p key={i}>{t}</p>) : <p className="muted">暂无简介。项目书与资料见「更多」中的完整项目入口。</p>}
        <button type="button" className="text-button" onClick={() => s.go('programs/' + team.program)}>查看完整项目与资料<ChevronRight size={14} /></button>
      </div>
    </div>
  </section>;
}

/** @deprecated Prefer TeamAdmissionPanel + TeamCoursesPanel in tabbed TeamDetail. Kept for any external import. */
export function TeamOfferSummary({ team, courses }: { team: Team; courses?: TeamCourse[] }) {
  return <><TeamAdmissionPanel team={team} /><TeamCoursesPanel team={team} courses={courses} /></>;
}

export function TeamRoster({ team, onEditMembers }: { team: Team; onEditMembers?: () => void }) {
  const s = useNexus();
  const entries = s.enrollments.filter(e => e.team === team.id && e.status !== '已退出');
  return <section className="glass panel team-tab-panel">
    <SectionTitle title={`队员 · ${entries.length} 人`} sub="可查看年级与参与状态；非本人负责的学生隐藏姓名与档案入口" />
    {entries.map(e => {
      const x = s.students.find(x => x.id === e.student); if (!x) return null;
      const mine = s.role !== 'sales' || salesOwns(x.sales, { name: s.user?.name, salesName: s.user?.salesName });
      return <div key={e.id} className="record-link">
        <span className="avatar">{mine ? x.name.slice(0, 1) : '•'}</span>
        <div><h3>{mine ? x.name : '已报名队员（姓名隐藏）'}</h3><p>{x.grade} · {mine ? x.sales : '其他顾问负责'}</p></div>
        <Badge>{e.status}</Badge>
        {mine && <button type="button" className="text-button" onClick={() => s.go('students/' + x.id)}>查看档案</button>}
      </div>;
    })}
    {!entries.length && (
      <EmptyState
        icon={Users}
        title="本队伍尚无队员"
        description="从编辑队伍中添加报名成员，或等销售端确认报名后自动出现。"
        action={onEditMembers && s.role !== 'sales' ? '添加队员' : undefined}
        onAction={onEditMembers}
      />
    )}
    {!!entries.length && onEditMembers && s.role !== 'sales' && (
      <div className="actions" style={{ marginTop: 12 }}>
        <button type="button" className="secondary compact" onClick={onEditMembers}><UserPlus size={15} />管理队员</button>
      </div>
    )}
  </section>;
}
