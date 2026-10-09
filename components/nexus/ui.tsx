'use client';
import { Search, ChevronRight, Layers, Inbox } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { Program } from '@/lib/nexus/data';
export const Badge=({children,tone='violet'}:{children:React.ReactNode;tone?:string})=><span className={`badge ${tone}`}>{children}</span>;
export function ProgramMark({program,small=false}:{program:Program;small?:boolean}){return <span className={`program-mark ${program.color} ${small?'small':''}`}>{program.short.length>4?<Layers size={small?18:25}/>:program.short}</span>}
export function SectionTitle({title,sub,action,onClick}:{title:string;sub?:string;action?:string;onClick?:()=>void}){return <div className="section-title"><div><h2>{title}</h2>{sub&&<span>{sub}</span>}</div>{action&&<button className="text-button" onClick={onClick}>{action}<ChevronRight size={15}/></button>}</div>}
export function SearchBox({value,onChange,placeholder='搜索…'}:{value:string;onChange:(v:string)=>void;placeholder?:string}){return <label className="search-box"><Search size={18}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/></label>}
export function Choice({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:string[];label:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger className="choice" aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>}
export function NoResults(){return <Empty><EmptyHeader><Inbox size={32}/><EmptyTitle>暂无匹配内容</EmptyTitle><EmptyDescription>试试其他关键词，或清除筛选条件。</EmptyDescription></EmptyHeader></Empty>}
export function StageBar({stage}:{stage:number}){return <div className="stage-track" aria-label={`已完成 ${stage} / 5 个阶段`}>{[0,1,2,3,4].map(i=><span key={i} className={i<stage?'complete':''}/>)}</div>}
export function Meter({value}:{value:number}){return <Progress value={value} className="meter"/>}
