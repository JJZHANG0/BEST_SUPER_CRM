'use client';
import { useState } from 'react';
import { Users, CalendarDays, GraduationCap, ClipboardList, FolderOpen, Search, ChevronRight, Download, Eye, Copy, CircleDollarSign, UserRoundCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useNexus, useVisible } from '@/lib/nexus/store';
import { cohortOffers, offerFor, cohortAvailability, money, priceText, planText } from '@/lib/nexus/recruitment';
import { assetUrl } from '@/lib/nexus/assets';
import { Badge, ProgramMark, SearchBox, Choice, Meter, NoResults, SectionTitle } from './ui';
import type { Team } from '@/lib/nexus/data';
export const greeting=()=>{const h=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',hour:'numeric',hourCycle:'h23'}).format(new Date()));return h<11?'早上好':h<14?'中午好':h<18?'下午好':'晚上好'};

export function Poster({program}:{program:string}) {
  const {programs}=useNexus();const [open,setOpen]=useState(false);
  const p=programs.find(x=>x.id===program)!;
  const src=assetUrl(`materials/poster-${program}.svg`);
  return <>
    <button className="secondary" onClick={()=>setOpen(true)}><Eye size={17}/>查看招生海报</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="file-preview">
      <DialogTitle>{p.name} · 招生海报</DialogTitle><DialogDescription>项目与价格信息以正式发布版本为准。</DialogDescription>
      <img className="preview-image" src={src} alt={`${p.name}招生海报`}/>
      <a className="primary" href={src} download={`${p.short}-招生海报.svg`} onClick={e=>{if(/MicroMessenger/i.test(navigator.userAgent)){e.preventDefault();toast.info('请在微信右上角菜单选择在浏览器中打开，再下载海报。')}}}><Download size={17}/>下载海报</a>
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
    <div className="sales-modal-actions"><Poster program={team.program}/><button className="primary" onClick={()=>{onOpenChange(false);s.go('programs/'+team.program)}}>查看项目资料<ChevronRight size={16}/></button></div>
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
function SalesPipeline() {
  const s=useNexus();const [selected,setSelected]=useState<Team|null>(null);const [q,setQ]=useState('');const [status,setStatus]=useState('全部状态');
  const list=s.teams.filter(team=>{const p=s.programs.find(p=>p.id===team.program)!;const a=cohortAvailability(team,s.enrollments);const hay=(p.name+team.name+team.id+offerFor(p.id).code).toLowerCase();return hay.includes(q.trim().toLowerCase())&&(status==='全部状态'||a.status===status)});
  const countLabel=list.length===s.teams.length?`${list.length} 个开班项目 · 点击任意一行查看详情`:`${list.length} 个开班项目 · 共 ${s.teams.length} 个 · 点击任意一行查看详情`;
  return <section className="glass sales-pipeline"><div className="sales-pipeline-title"><div><h2>招生项目概览</h2><span>{countLabel}</span></div><button className="text-button" onClick={()=>s.go('programs')}>项目库<ChevronRight size={15}/></button></div>
    <div className="filter-toolbar sales-pipeline-filters"><SearchBox value={q} onChange={setQ} placeholder="搜索项目、队伍或编号"/><Choice label="招生状态" value={status} onChange={setStatus} options={['全部状态','招生中','已满员','已截止','筹备中']}/></div>
    <div className="sales-pipeline-head" aria-hidden="true"><span>项目 / 队伍</span><span>招生进度</span><span>剩余名额</span><span>项目单价</span><span>状态</span><span/></div>
    <div className="sales-pipeline-body">{list.map(team=>{const p=s.programs.find(p=>p.id===team.program)!,offer=offerFor(p.id),a=cohortAvailability(team,s.enrollments);return <button className="sales-pipeline-row" key={team.id} onClick={()=>setSelected(team)} aria-label={`查看${p.name}${team.name}招生详情`}>
      <span className="sales-project-cell"><ProgramMark program={p} small/><span><strong>{p.name}</strong><small>{team.name} · {team.id}</small></span></span>
      <span className="sales-progress-cell"><span><b>{a.confirmed}</b> / {a.capacity} 人<small>{a.progress}%</small></span><Meter value={a.progress}/></span>
      <span className="sales-seats-cell"><b>{a.remaining}</b><small>个名额</small></span>
      <span className="sales-unit-price"><b>{priceText(offer.fee)}</b>{offer.fee>0&&<small>/ 人</small>}</span>
      <span className="sales-status-cell"><Badge tone={a.status==='招生中'?'green':'neutral'}>{a.status}</Badge></span><ChevronRight className="sales-row-arrow" size={18}/>
    </button>})}{!list.length&&<div className="sales-pipeline-empty"><NoResults/></div>}</div>
    <SalesCohortDialog team={selected} open={!!selected} onOpenChange={open=>{if(!open)setSelected(null)}}/>
  </section>;
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
export function TeamOfferSummary({team}:{team:Team}) {
  const s=useNexus(),p=s.programs.find(p=>p.id===team.program)!,offer=offerFor(p.id),cohort=cohortOffers[team.id],a=cohortAvailability(team,s.enrollments);
  const copy=async()=>{const text=`${p.name}｜${team.name}\n项目编号：${offer.code} / ${team.id}\n招生：${a.status}，已报 ${a.confirmed}/${a.capacity} 人${a.status==='招生中'?`，剩余 ${a.remaining} 席`:''}\n参考价：${priceText(offer.fee)}\n计划开课：${cohort?.opens||'待安排'}\n课程：${planText(offer)}\n授课老师：${team.teacher}\n运营对接：${offer.operations||'待指定'}\n以正式报价为准。`;try{await navigator.clipboard.writeText(text);toast.success('招生摘要已复制')}catch{toast.error('浏览器限制了复制，可直接选择页面文字复制。')}};
  return <><section className="glass panel offer-summary"><SectionTitle title="招生与开班信息" sub="对销售开放的信息 · 与内部运营备注分开"/>
    <div className="offer-metrics"><div><span>招生进度</span><b>{a.confirmed}<small> / {a.capacity} 人</small></b></div><div><span>{a.status==='招生中'?'剩余名额':'招生状态'}</span><b>{a.status==='招生中'?a.remaining:a.status}</b></div><div><span>项目参考价</span><b>{priceText(offer.fee)}{offer.fee>0&&<small> / 人</small>}</b></div></div><Meter value={a.progress}/>
    <dl className="info-grid"><div><dt>项目编号 / 队伍编号</dt><dd>{offer.code} / {team.id}</dd></div><div><dt>运营对接人</dt><dd>{offer.operations||'待指定'}</dd></div><div><dt>授课老师</dt><dd>{team.teacher}</dd></div><div><dt>老师介绍</dt><dd>{offer.teacherBio||'待补充'}</dd></div><div><dt>计划开课 / 报名截止</dt><dd>{cohort?.opens||'待安排'} / {cohort?.deadline||'待发布'}</dd></div><div><dt>上课时间</dt><dd>{cohort?.schedule||'待安排'}</dd></div><div><dt>课程总量</dt><dd>{planText(offer)}</dd></div><div><dt>费用与包含内容</dt><dd>{offer.feeNote}</dd></div></dl>
    <div className="actions"><Poster program={team.program}/><button className="secondary" onClick={copy}><Copy size={16}/>复制招生摘要</button><button className="secondary" onClick={()=>s.go('programs/'+team.program)}>查看完整项目与资料</button></div>
  </section><section className="glass panel course-plan"><SectionTitle title="课程计划" sub="具体排课见课程安排"/>{p.published?<ol className="curriculum">{p.curriculum.split('\n').map((name,i)=><li key={i}><span>{String(i+1).padStart(2,'0')}</span><div><h3>{name}</h3><p>导师指导 · 小组实践 · 阶段产出</p></div></li>)}</ol>:<p className="muted">课程计划尚未发布，具体安排由运营对接人确认。</p>}</section></>;
}
export function TeamRoster({team}:{team:Team}) {
  const s=useNexus();const entries=s.enrollments.filter(e=>e.team===team.id&&e.status!=='已退出');
  return <section className="glass panel"><SectionTitle title={`队员信息 · ${entries.length} 人`} sub="可查看队员年级与参与状态；非本人负责的学生隐藏姓名与档案入口"/>
    {entries.map(e=>{const x=s.students.find(x=>x.id===e.student);if(!x)return null;const mine=s.role!=='sales'||x.sales===(s.user?.salesName||'');return <div key={e.id} className="record-link"><span className="avatar">{mine?x.name.slice(0,1):'•'}</span><div><h3>{mine?x.name:'已报名队员（姓名隐藏）'}</h3><p>{x.grade} · {mine?x.sales:'其他顾问负责'}</p></div><Badge>{e.status}</Badge>{mine&&<button className="text-button" onClick={()=>s.go('students/'+x.id)}>查看档案</button>}</div>})}
    {!entries.length&&<p className="muted">本队伍尚未有报名成员。</p>}
  </section>;
}
export default function SalesHome() {
  const s=useNexus(),v=useVisible();const mine=new Set(v.students.map(x=>x.id));const revenue=s.enrollments.filter(e=>mine.has(e.student)&&!['已退出','待分配'].includes(e.status)).reduce((sum,e)=>sum+(offerFor(e.program).fee||0),0);const activeStudents=v.students.filter(x=>x.status==='进行中').length;const revenueText=revenue>=10000?(revenue/10000).toFixed(1)+'万':money(revenue);
  return <><div className="welcome sales-welcome"><div><div className="eyebrow">SALES WORKSPACE</div><h1>{greeting()}，{s.user?.name||'Alex'} <span className="hello-spark">✧</span></h1></div><Badge tone="neutral">销售工作台</Badge></div>
    <div className="stats-grid sales-stats">{[{label:'项目库',value:s.programs.length,unit:'个',icon:FolderOpen,to:'programs'},{label:'我的学生',value:v.students.length,unit:'位',icon:ClipboardList,to:'students'},{label:'我的当前营收',value:revenueText,unit:'',icon:CircleDollarSign,to:'students'},{label:'进行中学生',value:activeStudents,unit:'位',icon:UserRoundCheck,to:'students'}].map(x=><button key={x.label} className="glass stat-card" onClick={()=>s.go(x.to)}><div className="stat-top"><span>{x.label}</span><span className="stat-icon violet"><x.icon size={16}/></span></div><div className="stat-value">{x.value}<span>{x.unit}</span></div><div className="stat-foot">查看详情<ChevronRight size={13}/></div></button>)}</div>
    <SalesPipeline/>
    <footer className="page-footer"><span>B.E.S.T · Innovation, connected.</span><span>{s.apiMode?'实时数据':'预览站 · 数据保存在本浏览器'}</span></footer>
  </>;
}
