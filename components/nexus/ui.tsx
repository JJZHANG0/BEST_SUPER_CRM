'use client';
import { Search, ChevronRight, ChevronLeft, Layers, Inbox, Plus, ShieldCheck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { Program } from '@/lib/nexus/data';
import { useNexus } from '@/lib/nexus/store';
import { healthHints, isHealth } from '@/lib/nexus/students';
export const Badge=({children,tone='violet'}:{children:React.ReactNode;tone?:string})=><span className={`badge ${tone}`}>{children}</span>;
export function ProgramMark({program,small=false}:{program:Program;small?:boolean}){return <span className={`program-mark ${program.color} ${small?'small':''}`}>{program.short.length>4?<Layers size={small?18:25}/>:program.short}</span>}
export function SectionTitle({title,sub,action,onClick}:{title:string;sub?:string;action?:string;onClick?:()=>void}){return <div className="section-title"><div><h2>{title}</h2>{sub&&<span>{sub}</span>}</div>{action&&<button className="text-button" onClick={onClick}>{action}<ChevronRight size={15}/></button>}</div>}
export function SearchBox({value,onChange,placeholder='搜索…'}:{value:string;onChange:(v:string)=>void;placeholder?:string}){return <label className="search-box"><Search size={18}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/></label>}
export function Choice({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:string[];label:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger className="choice" aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>}
export function NoResults(){return <Empty><EmptyHeader><Inbox size={32}/><EmptyTitle>暂无匹配内容</EmptyTitle><EmptyDescription>试试其他关键词，或清除筛选条件。</EmptyDescription></EmptyHeader></Empty>}
export function StageBar({stage}:{stage:number}){return <div className="stage-track" aria-label={`已完成 ${stage} / 5 个阶段`}>{[0,1,2,3,4].map(i=><span key={i} className={i<stage?'complete':''}/>)}</div>}
export function Meter({value}:{value:number}){return <Progress value={value} className="meter"/>}
export function PageTitle({title,en,description,action,onAction}:{title:string;en:string;description:string;action?:string;onAction?:()=>void}){return <div className="page-title"><div><div className="eyebrow">{en}</div><h1>{title}</h1><p>{description}</p></div>{action&&<button className="primary" onClick={onAction}><Plus size={17}/>{action}</button>}</div>}
export function Back({to,label='返回列表'}:{to:string;label?:string}){const {go}=useNexus();return <button className="back-button" onClick={()=>go(to)}><ChevronLeft size={17}/>{label}</button>}
export function FormField({label,children}:{label:string;children:React.ReactNode}){return <label className="form-field"><span>{label}</span>{children}</label>}
export function Notice({children}:{children:React.ReactNode}){return <div className="notice"><ShieldCheck size={17}/><span>{children}</span></div>}
/** 学生状态 badge: flat status colours (red / amber / green), worst → best. */
export function HealthBadge({value,title}:{value:unknown;title?:boolean}){const known=isHealth(value);const tone=!known?'unknown':value==='状态不佳'?'poor':value==='需关注'?'watch':'good';return <span className={'health-badge '+tone} title={title&&known?healthHints[value]:undefined}><i aria-hidden="true"/>{known?value:'待评估'}</span>}
/** Select with separate value / label (ids stay out of the visible text). Empty value is mapped to a sentinel. */
export function Picker({value,onChange,options,label,className}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label:string;className?:string}){const enc=(v:string)=>v===''?'__none':v;return <Select value={enc(value)} onValueChange={v=>onChange(v==='__none'?'':v)}><SelectTrigger className={'choice '+(className||'')} aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.value||'__none'} value={enc(o.value)}>{o.label}</SelectItem>)}</SelectContent></Select>}
/** Friendly empty state with an optional call to action. */
export function EmptyState({icon:Icon=Inbox,title,description,action,onAction}:{icon?:React.ComponentType<{size?:number}>;title:string;description?:string;action?:string;onAction?:()=>void}){return <Empty className="empty-state"><EmptyHeader><span className="empty-state-icon"><Icon size={22}/></span><EmptyTitle>{title}</EmptyTitle>{description&&<EmptyDescription>{description}</EmptyDescription>}</EmptyHeader>{action&&<button className="primary compact" onClick={onAction}><Plus size={16}/>{action}</button>}</Empty>}
