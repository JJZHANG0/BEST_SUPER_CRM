'use client';
import { createContext, useContext, useState, useEffect, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import * as seed from './data';
import { seedArticles } from './article-seed';
import { mergeStoredArticles, type ProgramArticle } from './articles';
import { seedAssignments, isHealth, type Assignment } from './students';
export type FileRecord=seed.Resource & {url?:string};
export type Store={authenticated:boolean;setAuthenticated:Dispatch<SetStateAction<boolean>>;enrollments:seed.Enrollment[];setEnrollments:Dispatch<SetStateAction<seed.Enrollment[]>>;role:seed.Role;setRole:Dispatch<SetStateAction<seed.Role>>;programs:seed.Program[];setPrograms:Dispatch<SetStateAction<seed.Program[]>>;students:seed.Student[];setStudents:Dispatch<SetStateAction<seed.Student[]>>;teams:seed.Team[];setTeams:Dispatch<SetStateAction<seed.Team[]>>;courses:seed.Course[];setCourses:Dispatch<SetStateAction<seed.Course[]>>;feedbacks:seed.Feedback[];setFeedbacks:Dispatch<SetStateAction<seed.Feedback[]>>;files:FileRecord[];setFiles:Dispatch<SetStateAction<FileRecord[]>>;route:string;go:(route:string)=>void;favorites:string[];setFavorites:Dispatch<SetStateAction<string[]>>;recent:string[];setRecent:Dispatch<SetStateAction<string[]>>;logs:string[];log:(s:string)=>void;
  /** Homework / assignment records shown in student detail. */
  assignments:Assignment[];setAssignments:Dispatch<SetStateAction<Assignment[]>>;
  /** 项目推文: ops edit drafts and publish; sales read the published snapshot. */
  articles:ProgramArticle[];updateArticles:(fn:(list:ProgramArticle[])=>ProgramArticle[])=>boolean;
  /** False when the browser refused to persist (quota / private mode). */
  persisted:boolean};
const Context=createContext<Store>(null!);
/**
 * There is no backend on the static GitHub Pages build, so published articles and
 * student statuses are kept in this browser's localStorage. Everything else stays
 * session-only, as before.
 */
export const STORAGE_KEYS={articles:'nexus.demo.articles.v1',health:'nexus.demo.student-health.v1'} as const;
const teacherFor=(program:string)=>seed.teams.find(t=>t.program===program)?.teacher??'陈老师';
function read(key:string){if(typeof window==='undefined')return null;try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null}catch{return null}}
/** Apply statuses ops saved in this browser. Runs in the state initialiser: the pre-login static HTML never renders students, so there is no hydration mismatch. */
function withStoredHealth(list:seed.Student[]){const stored=read(STORAGE_KEYS.health);if(!stored||typeof stored!=='object')return list;return list.map(x=>{const h=(stored as Record<string,{health?:unknown;healthNote?:unknown;healthUpdated?:unknown;healthBy?:unknown}>)[x.id];return h&&isHealth(h.health)?{...x,health:h.health,healthNote:String(h.healthNote??''),healthUpdated:String(h.healthUpdated??''),healthBy:String(h.healthBy??'')}:x})}
export function Provider({children}:{children:ReactNode}){const [authenticated,setAuthenticated]=useState(false);const [enrollments,setEnrollments]=useState(seed.enrollments);const [role,setRole]=useState<seed.Role>('sales'),[programs,setPrograms]=useState(seed.programs),[students,setStudents]=useState(()=>withStoredHealth(seed.students)),[teams,setTeams]=useState(seed.teams),[courses,setCourses]=useState(seed.courses),[feedbacks,setFeedbacks]=useState(seed.feedbacks),[files,setFiles]=useState<FileRecord[]>(seed.resources),[route,setRoute]=useState('dashboard'),[favorites,setFavorites]=useState<string[]>([]),[recent,setRecent]=useState<string[]>([]),[logs,setLogs]=useState<string[]>(['演示工作空间已就绪']);
 const [assignments,setAssignments]=useState<Assignment[]>(()=>seedAssignments(seed.students,teacherFor));
 const [articles,setArticles]=useState<ProgramArticle[]>(()=>{const saved=read(STORAGE_KEYS.articles);return saved?mergeStoredArticles(seedArticles,saved):seedArticles});
 const [persisted,setPersisted]=useState(true);
 /** Article changes come from ops actions; persist right away so a quota error can be reported in the editor. */
 const updateArticles=(fn:(list:ProgramArticle[])=>ProgramArticle[])=>{const next=fn(articles);setArticles(next);let ok=true;try{localStorage.setItem(STORAGE_KEYS.articles,JSON.stringify(next))}catch{ok=false}setPersisted(ok);return ok};
 const go=(s:string)=>{window.location.hash='/'+s;setRoute(s);window.scrollTo({top:0,behavior:'instant'});};
 useEffect(()=>{const change=()=>{setRoute(decodeURI(location.hash.replace(/^#\/?/,''))||'dashboard');window.scrollTo(0,0)};change();window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[]);
 // Only statuses that differ from the seed are stored (tiny payload, written whenever students change).
 useEffect(()=>{const changed=Object.fromEntries(students.filter(x=>{const o=seed.students.find(s=>s.id===x.id);return !o||o.health!==x.health||o.healthNote!==x.healthNote}).map(x=>[x.id,{health:x.health,healthNote:x.healthNote,healthUpdated:x.healthUpdated,healthBy:x.healthBy}]));try{localStorage.setItem(STORAGE_KEYS.health,JSON.stringify(changed))}catch{/* storage unavailable: statuses stay session-only */}},[students]);
 return <Context.Provider value={{authenticated,setAuthenticated,enrollments,setEnrollments,role,setRole,programs,setPrograms,students,setStudents,teams,setTeams,courses,setCourses,feedbacks,setFeedbacks,files,setFiles,route,go,favorites,setFavorites,recent,setRecent,logs,log:(s)=>setLogs(v=>[s,...v]),assignments,setAssignments,articles,updateArticles,persisted}}>{children}</Context.Provider>}
export const useNexus=()=>useContext(Context);
export function useVisible(){const s=useNexus();const students=s.students.filter(x=>s.role!=='sales'||x.sales==='顾问 Alex');const teams=s.teams;return {students,teams,courses:s.courses.filter(c=>s.role!=='sales'||(teams.some(t=>t.id===c.team)&&s.programs.find(p=>p.id===c.program)?.published)),files:s.files.filter(f=>s.role!=='sales'||f.public),feedbacks:s.feedbacks.filter(f=>s.role!=='sales'||(f.visible&&students.some(x=>x.id===f.student)))};}
