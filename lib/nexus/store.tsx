'use client';
import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import * as seed from './data';
import { seedArticles } from './article-seed';
import { mergeStoredArticles, type ProgramArticle } from './articles';
import { seedAssignments, isHealth, type Assignment } from './students';
import { authenticateDemo } from './auth';
import { api, API_ENABLED, ApiError, token, stableJson, changedRecords, type ApiUser, type ApiTodo, type Collection } from './api';
import { seedTodos, mergeStoredTodos, newTodoId, DEMO_TODO_USER, type Todo } from './todos';
export type FileRecord=seed.Resource & {url?:string};
export type LoginResult={ok:true;role:seed.Role}|{ok:false;error:string};
export type Store={authenticated:boolean;setAuthenticated:Dispatch<SetStateAction<boolean>>;enrollments:seed.Enrollment[];setEnrollments:Dispatch<SetStateAction<seed.Enrollment[]>>;role:seed.Role;setRole:Dispatch<SetStateAction<seed.Role>>;programs:seed.Program[];setPrograms:Dispatch<SetStateAction<seed.Program[]>>;students:seed.Student[];setStudents:Dispatch<SetStateAction<seed.Student[]>>;teams:seed.Team[];setTeams:Dispatch<SetStateAction<seed.Team[]>>;courses:seed.Course[];setCourses:Dispatch<SetStateAction<seed.Course[]>>;feedbacks:seed.Feedback[];setFeedbacks:Dispatch<SetStateAction<seed.Feedback[]>>;files:FileRecord[];setFiles:Dispatch<SetStateAction<FileRecord[]>>;route:string;go:(route:string)=>void;favorites:string[];setFavorites:Dispatch<SetStateAction<string[]>>;recent:string[];setRecent:Dispatch<SetStateAction<string[]>>;logs:string[];log:(s:string)=>void;
  /** Homework / assignment records shown in student detail. */
  assignments:Assignment[];setAssignments:Dispatch<SetStateAction<Assignment[]>>;
  /** 项目推文: ops edit drafts and publish; sales read the published snapshot. */
  articles:ProgramArticle[];updateArticles:(fn:(list:ProgramArticle[])=>ProgramArticle[])=>boolean;
  /** Personal todos for the signed-in user (ops homepage + 待办/已完成 pages). */
  todos:Todo[];
  addTodo:(input:{title:string;note?:string;dueAt?:string|null})=>Promise<boolean>;
  completeTodo:(id:string)=>Promise<boolean>;
  restoreTodo:(id:string)=>Promise<boolean>;
  deleteTodo:(id:string)=>Promise<boolean>;
  updateTodo:(id:string,patch:{title?:string;note?:string|null;dueAt?:string|null})=>Promise<boolean>;
  /** False when changes could not be saved (browser storage refused, or the API rejected them). */
  persisted:boolean;
  /** True when this build talks to the NEXUS API (shared database); false in the static demo. */
  apiMode:boolean;user:ApiUser|null;
  /** True while a saved API session is being restored on page load. */
  restoring:boolean;
  login:(email:string,password:string)=>Promise<LoginResult>;logout:()=>void};
const Context=createContext<Store>(null!);
/**
 * Demo mode (no NEXT_PUBLIC_API_BASE, e.g. GitHub Pages): published articles and student statuses
 * are kept in this browser's localStorage; everything else is session-only.
 * API mode: data is loaded from /api/bootstrap after login and every record the UI changes is
 * written back with PUT /api/<collection>/<id>; the server is the source of truth.
 */
export const STORAGE_KEYS={articles:'nexus.demo.articles.v1',health:'nexus.demo.student-health.v1',todos:'nexus.demo.todos.v1'} as const;
const teacherFor=(program:string)=>seed.teams.find(t=>t.program===program)?.teacher??'陈老师';
function read(key:string){if(API_ENABLED||typeof window==='undefined')return null;try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null}catch{return null}}
/** Apply statuses ops saved in this browser. Runs in the state initialiser: the pre-login static HTML never renders students, so there is no hydration mismatch. */
function withStoredHealth(list:seed.Student[]){const stored=read(STORAGE_KEYS.health);if(!stored||typeof stored!=='object')return list;return list.map(x=>{const h=(stored as Record<string,{health?:unknown;healthNote?:unknown;healthUpdated?:unknown;healthBy?:unknown}>)[x.id];return h&&isHealth(h.health)?{...x,health:h.health,healthNote:String(h.healthNote??''),healthUpdated:String(h.healthUpdated??''),healthBy:String(h.healthBy??'')}:x})}
type Bootstrap={user:ApiUser;programs:seed.Program[];teams:seed.Team[];students:seed.Student[];enrollments:seed.Enrollment[];courses:seed.Course[];feedbacks:seed.Feedback[];resources:FileRecord[];assignments:Assignment[];articles:ProgramArticle[];todos?:ApiTodo[]};
/** Browser-only fields that never go to the API. */
const OMIT:Partial<Record<Collection,string[]>>={resources:['url']};
const idOf=(x:{id?:string;program?:string})=>(x.id??x.program) as string;
const asTodo=(t:ApiTodo):Todo=>({id:t.id,userId:t.userId,title:t.title,note:t.note??undefined,dueAt:t.dueAt??null,completedAt:t.completedAt??null,createdAt:t.createdAt,updatedAt:t.updatedAt});

export function Provider({children}:{children:ReactNode}){const [authenticated,setAuthenticated]=useState(false);const [enrollments,setEnrollments]=useState(seed.enrollments);const [role,setRole]=useState<seed.Role>('sales'),[programs,setPrograms]=useState(seed.programs),[students,setStudents]=useState(()=>withStoredHealth(seed.students)),[teams,setTeams]=useState(seed.teams),[courses,setCourses]=useState(seed.courses),[feedbacks,setFeedbacks]=useState(seed.feedbacks),[files,setFiles]=useState<FileRecord[]>(seed.resources),[route,setRoute]=useState('dashboard'),[favorites,setFavorites]=useState<string[]>([]),[recent,setRecent]=useState<string[]>([]),[logs,setLogs]=useState<string[]>(['演示工作空间已就绪']);
 const [assignments,setAssignments]=useState<Assignment[]>(()=>seedAssignments(seed.students,teacherFor));
 const [articles,setArticles]=useState<ProgramArticle[]>(()=>{const saved=read(STORAGE_KEYS.articles);return saved?mergeStoredArticles(seedArticles,saved):seedArticles});
 const [todos,setTodos]=useState<Todo[]>(()=>{const saved=read(STORAGE_KEYS.todos);return mergeStoredTodos(seedTodos(DEMO_TODO_USER),saved)});
 const [persisted,setPersisted]=useState(true);
 const [user,setUser]=useState<ApiUser|null>(null);
 const [restoring,setRestoring]=useState(API_ENABLED);
 /** Last server-confirmed JSON per collection and record id (API mode only). */
 const synced=useRef<Partial<Record<Collection,Map<string,string>>>>({});
 const inflight=useRef(new Map<string,string>());
 const setters=useRef<Record<Collection,(list:never[])=>void>>({programs:setPrograms,teams:setTeams,students:setStudents,enrollments:setEnrollments,courses:setCourses,feedbacks:setFeedbacks,resources:setFiles,assignments:setAssignments,articles:setArticles} as never).current;
 const applyServer=useCallback((data:Bootstrap)=>{
  const sets:Record<Collection,unknown[]>={programs:data.programs,teams:data.teams,students:data.students,enrollments:data.enrollments,courses:data.courses,feedbacks:data.feedbacks,resources:data.resources,assignments:data.assignments,articles:data.articles};
  for(const [name,list] of Object.entries(sets) as [Collection,{id?:string;program?:string}[]][]){synced.current[name]=new Map(list.map(x=>[idOf(x),stableJson(x,OMIT[name])]));}
  setPrograms(data.programs);setTeams(data.teams);setStudents(data.students);setEnrollments(data.enrollments);setCourses(data.courses);setFeedbacks(data.feedbacks);setAssignments(data.assignments);setArticles(data.articles);
  // Keep blob URLs of files uploaded in this tab.
  setFiles(prev=>data.resources.map(r=>({...r,url:prev.find(p=>p.id===r.id)?.url})));
  setUser(data.user);setRole(data.user.role);
  setTodos((data.todos??[]).map(asTodo));
 },[]);
 const refresh=useCallback(async()=>{if(inflight.current.size)return;try{applyServer(await api.bootstrap<Bootstrap>())}catch(e){if(e instanceof ApiError&&e.status===401){token.clear();setAuthenticated(false)}}},[applyServer]);
 // Restore a saved API session on load.
 useEffect(()=>{if(!API_ENABLED)return;(async()=>{if(!token.get())return;try{applyServer(await api.bootstrap<Bootstrap>());setAuthenticated(true)}catch{token.clear()}})().finally(()=>setRestoring(false))},[applyServer]);
 // Pick up other users' changes: on focus and every 30 s.
 useEffect(()=>{if(!API_ENABLED||!authenticated)return;const onFocus=()=>{if(document.visibilityState==='visible')refresh()};const t=setInterval(onFocus,30_000);window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onFocus);return()=>{clearInterval(t);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus)}},[authenticated,refresh]);
 /** Write changed records of one collection back to the API. */
 const push=useCallback((name:Collection,list:{id?:string;program?:string}[])=>{
  const map=synced.current[name];if(!API_ENABLED||!map)return;
  for(const rec of changedRecords(list,map,idOf,OMIT[name])){
   const key=name+':'+idOf(rec),body=stableJson(rec,OMIT[name]);if(inflight.current.get(key)===body)continue;inflight.current.set(key,body);
   const payload=JSON.parse(body);
   api.put<{id?:string;program?:string}>(name,idOf(rec),payload).then(({record})=>{
    const canonical=stableJson(record,OMIT[name]);map.set(idOf(record),canonical);setPersisted(true);
    // Adopt server-side fields (e.g. 状态更新人/时间) without re-sending.
    if(canonical!==body)(setters[name] as unknown as Dispatch<SetStateAction<{id?:string;program?:string}[]>>)(l=>l.map(x=>idOf(x)===idOf(record)?{...x,...record}:x));
   }).catch(e=>{setPersisted(false);toast.error(e instanceof ApiError&&e.status===403?'此操作仅项目运营老师可用，修改未保存':'保存到服务器失败，请稍后重试');if(e instanceof ApiError&&e.status===401){token.clear();setAuthenticated(false)}}).finally(()=>{if(inflight.current.get(key)===body)inflight.current.delete(key);if(!inflight.current.size)setTimeout(()=>{if(!inflight.current.size)void refresh()},50)});
  }
 },[refresh,setters]);
 useEffect(()=>{if(authenticated)push('programs',programs)},[programs,authenticated,push]);
 useEffect(()=>{if(authenticated)push('teams',teams)},[teams,authenticated,push]);
 useEffect(()=>{if(authenticated)push('students',students)},[students,authenticated,push]);
 useEffect(()=>{if(authenticated)push('enrollments',enrollments)},[enrollments,authenticated,push]);
 useEffect(()=>{if(authenticated)push('courses',courses)},[courses,authenticated,push]);
 useEffect(()=>{if(authenticated)push('feedbacks',feedbacks)},[feedbacks,authenticated,push]);
 useEffect(()=>{if(authenticated)push('resources',files)},[files,authenticated,push]);
 useEffect(()=>{if(authenticated)push('assignments',assignments)},[assignments,authenticated,push]);
 useEffect(()=>{if(authenticated)push('articles',articles)},[articles,authenticated,push]);
 /** Article changes come from ops actions; persist right away so a quota error can be reported in the editor. */
 const updateArticles=(fn:(list:ProgramArticle[])=>ProgramArticle[])=>{const next=fn(articles);setArticles(next);if(API_ENABLED)return true;let ok=true;try{localStorage.setItem(STORAGE_KEYS.articles,JSON.stringify(next))}catch{ok=false}setPersisted(ok);return ok};
 const login=async(email:string,password:string):Promise<LoginResult>=>{
  if(!API_ENABLED){const match=authenticateDemo(email,password);if(!match)return {ok:false,error:'账号或密码不正确。请检查输入，或使用下方示例账号。'};setRole(match.role);setAuthenticated(true);return {ok:true,role:match.role}}
  try{const res=await api.login(email,password);token.set(res.token);applyServer(await api.bootstrap<Bootstrap>());setAuthenticated(true);return {ok:true,role:res.user.role}}
  catch(e){token.clear();return {ok:false,error:e instanceof ApiError?(e.status===401?'账号或密码不正确。请检查输入，或使用下方示例账号。':e.status===429?'尝试次数过多，请 10 分钟后再试。':'服务器暂时不可用，请稍后重试。'):'无法连接服务器，请检查网络后重试。'}}
 };
 const logout=()=>{token.clear();setUser(null);setAuthenticated(false)};
 // Any path that signs out (including setAuthenticated(false)) drops the API session.
 const wasAuthed=useRef(false);
 useEffect(()=>{if(wasAuthed.current&&!authenticated&&API_ENABLED){token.clear();setUser(null)}wasAuthed.current=authenticated},[authenticated]);
 const go=(s:string)=>{window.location.hash='/'+s;setRoute(s);window.scrollTo({top:0,behavior:'instant'});};
 useEffect(()=>{const change=()=>{setRoute(decodeURI(location.hash.replace(/^#\/?/,''))||'dashboard');window.scrollTo(0,0)};change();window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[]);
 // Demo mode only: statuses that differ from the seed are stored (tiny payload, written whenever students change).
 useEffect(()=>{if(API_ENABLED)return;const changed=Object.fromEntries(students.filter(x=>{const o=seed.students.find(s=>s.id===x.id);return !o||o.health!==x.health||o.healthNote!==x.healthNote}).map(x=>[x.id,{health:x.health,healthNote:x.healthNote,healthUpdated:x.healthUpdated,healthBy:x.healthBy}]));try{localStorage.setItem(STORAGE_KEYS.health,JSON.stringify(changed))}catch{/* storage unavailable: statuses stay session-only */}},[students]);

 const demoUserKey=()=>user?.email||(role==='ops'?DEMO_TODO_USER:'sales@nexus.demo');
 const persistTodos=(list:Todo[])=>{if(API_ENABLED)return true;try{localStorage.setItem(STORAGE_KEYS.todos,JSON.stringify(list));setPersisted(true);return true}catch{setPersisted(false);return false}};
 const addTodo=async(input:{title:string;note?:string;dueAt?:string|null})=>{
  const title=input.title.trim();if(!title)return false;
  if(API_ENABLED){try{const {todo}=await api.createTodo({title,note:input.note??null,dueAt:input.dueAt??null});setTodos(l=>[asTodo(todo),...l]);setPersisted(true);return true}catch(e){setPersisted(false);toast.error(e instanceof ApiError?'保存待办失败':'无法连接服务器');return false}}
  const now=new Date().toISOString();
  const item:Todo={id:newTodoId(),userId:demoUserKey(),title,note:input.note?.trim()||undefined,dueAt:input.dueAt??null,completedAt:null,createdAt:now,updatedAt:now};
  let ok=true;setTodos(l=>{const next=[item,...l];ok=persistTodos(next);return next});return ok;
 };
 const completeTodo=async(id:string)=>{
  const stamp=new Date().toISOString();
  if(API_ENABLED){try{const {todo}=await api.updateTodo(id,{completedAt:stamp});setTodos(l=>l.map(t=>t.id===id?asTodo(todo):t));setPersisted(true);return true}catch{setPersisted(false);toast.error('标记完成失败');return false}}
  let ok=true;setTodos(l=>{const next=l.map(t=>t.id===id?{...t,completedAt:stamp,updatedAt:stamp}:t);ok=persistTodos(next);return next});return ok;
 };
 const restoreTodo=async(id:string)=>{
  if(API_ENABLED){try{const {todo}=await api.updateTodo(id,{completedAt:null});setTodos(l=>l.map(t=>t.id===id?asTodo(todo):t));setPersisted(true);return true}catch{setPersisted(false);toast.error('恢复待办失败');return false}}
  const stamp=new Date().toISOString();
  let ok=true;setTodos(l=>{const next=l.map(t=>t.id===id?{...t,completedAt:null,updatedAt:stamp}:t);ok=persistTodos(next);return next});return ok;
 };
 const deleteTodo=async(id:string)=>{
  if(API_ENABLED){try{await api.deleteTodo(id);setTodos(l=>l.filter(t=>t.id!==id));setPersisted(true);return true}catch{setPersisted(false);toast.error('删除待办失败');return false}}
  let ok=true;setTodos(l=>{const next=l.filter(t=>t.id!==id);ok=persistTodos(next);return next});return ok;
 };
 const updateTodo=async(id:string,patch:{title?:string;note?:string|null;dueAt?:string|null})=>{
  if(API_ENABLED){try{const {todo}=await api.updateTodo(id,patch);setTodos(l=>l.map(t=>t.id===id?asTodo(todo):t));setPersisted(true);return true}catch{setPersisted(false);toast.error('更新待办失败');return false}}
  const stamp=new Date().toISOString();
  let ok=true;setTodos(l=>{const next=l.map(t=>t.id===id?{...t,...('title' in patch&&patch.title!=null?{title:patch.title.trim()}:{}),...('note' in patch?{note:patch.note??undefined}:{}),...('dueAt' in patch?{dueAt:patch.dueAt??null}:{}),updatedAt:stamp}:t);ok=persistTodos(next);return next});return ok;
 };
 return <Context.Provider value={{authenticated,setAuthenticated,enrollments,setEnrollments,role,setRole,programs,setPrograms,students,setStudents,teams,setTeams,courses,setCourses,feedbacks,setFeedbacks,files,setFiles,route,go,favorites,setFavorites,recent,setRecent,logs,log:(s)=>setLogs(v=>[s,...v]),assignments,setAssignments,articles,updateArticles,todos,addTodo,completeTodo,restoreTodo,deleteTodo,updateTodo,persisted,apiMode:API_ENABLED,user,restoring,login,logout}}>{children}</Context.Provider>}
export const useNexus=()=>useContext(Context);
export function useVisible(){const s=useNexus();const salesName=s.user?.salesName||'顾问 Alex';const students=s.students.filter(x=>s.role!=='sales'||x.sales===salesName);const teams=s.teams;return {students,teams,courses:s.courses.filter(c=>s.role!=='sales'||(teams.some(t=>t.id===c.team)&&s.programs.find(p=>p.id===c.program)?.published)),files:s.files.filter(f=>s.role!=='sales'||f.public),feedbacks:s.feedbacks.filter(f=>s.role!=='sales'||(f.visible&&students.some(x=>x.id===f.student)))};}
