'use client';
import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import * as seed from './data';
import { seedArticles } from './article-seed';
import { mergeStoredArticles, type ProgramArticle } from './articles';
import { isHealth, type Assignment } from './students';
import { authenticateDemo, directory, makeHash, randomPassword, type Overrides, type DirectoryUser } from './auth';
import { api, API_ENABLED, ApiError, token, stableJson, changedRecords, type ApiUser, type ApiTodo, type Collection, type OpsCollection, type StaffMember, type AdminUser } from './api';
import { storedTodos, newTodoId, type Todo } from './todos';
import { defaultClassTypes, type ClassType, type Project, type OpsCourse, type LessonRecord, type LessonFeedback } from './ops';
import { isOpsLike, passwordIssues, type Role } from './roles';
export type FileRecord=seed.Resource & {url?:string};
export type LoginResult={ok:true;role:Role}|{ok:false;error:string};
type St<T>=Dispatch<SetStateAction<T>>;
export type Store={authenticated:boolean;setAuthenticated:St<boolean>;enrollments:seed.Enrollment[];setEnrollments:St<seed.Enrollment[]>;role:Role;setRole:St<Role>;programs:seed.Program[];setPrograms:St<seed.Program[]>;students:seed.Student[];setStudents:St<seed.Student[]>;teams:seed.Team[];setTeams:St<seed.Team[]>;courses:seed.Course[];setCourses:St<seed.Course[]>;feedbacks:seed.Feedback[];setFeedbacks:St<seed.Feedback[]>;files:FileRecord[];setFiles:St<FileRecord[]>;route:string;go:(route:string)=>void;favorites:string[];setFavorites:St<string[]>;recent:string[];setRecent:St<string[]>;logs:string[];log:(s:string)=>void;
  /** Homework / assignment records shown in student detail. */
  assignments:Assignment[];setAssignments:St<Assignment[]>;
  /** 项目推文: ops edit drafts and publish; sales read the published snapshot. */
  articles:ProgramArticle[];updateArticles:(fn:(list:ProgramArticle[])=>ProgramArticle[])=>boolean;
  /** Personal todos for the signed-in user (ops homepage + 待办/已完成 pages). */
  todos:Todo[];
  addTodo:(input:{title:string;note?:string;dueAt?:string|null})=>Promise<boolean>;
  completeTodo:(id:string)=>Promise<boolean>;
  restoreTodo:(id:string)=>Promise<boolean>;
  deleteTodo:(id:string)=>Promise<boolean>;
  updateTodo:(id:string,patch:{title?:string;note?:string|null;dueAt?:string|null})=>Promise<boolean>;
  /** 班型与津贴标准, 项目编号, 课程, 课时记录, 课情反馈. */
  classTypes:ClassType[];setClassTypes:St<ClassType[]>;
  projects:Project[];setProjects:St<Project[]>;
  opsCourses:OpsCourse[];setOpsCourses:St<OpsCourse[]>;
  lessons:LessonRecord[];setLessons:St<LessonRecord[]>;
  lessonFeedbacks:LessonFeedback[];setLessonFeedbacks:St<LessonFeedback[]>;
  /** Delete one record of an ops collection (API: DELETE; demo: local). */
  removeRecord:(name:OpsCollection,id:string)=>Promise<boolean>;
  /** Ops teachers (教务老师) for pickers and name lookups. */
  staff:StaffMember[];staffName:(email:string)=>string;
  /** Change the signed-in user's password. Resolves to an error message, or null on success. */
  changePassword:(current:string,next:string)=>Promise<string|null>;
  /** 系统管理 · 用户管理 (superadmin). */
  admin:{list:()=>Promise<AdminUser[]>;create:(u:{email:string;name:string;role:Role;salesName?:string|null})=>Promise<{ok:true;password:string}|{ok:false;error:string}>;update:(u:AdminUser,patch:{name?:string;role?:Role;active?:boolean})=>Promise<string|null>;resetPassword:(u:AdminUser)=>Promise<{ok:true;password:string}|{ok:false;error:string}>};
  /** False when changes could not be saved (browser storage refused, or the API rejected them). */
  persisted:boolean;
  /** True when this build talks to the NEXUS API (shared database); false in the static demo. */
  apiMode:boolean;user:ApiUser|null;
  /** True while a saved API session is being restored on page load. */
  restoring:boolean;
  login:(email:string,password:string)=>Promise<LoginResult>;logout:()=>void};
const Context=createContext<Store>(null!);
/**
 * Demo mode (no NEXT_PUBLIC_API_BASE, e.g. GitHub Pages): records are kept in this browser's
 * localStorage (uploaded files stay session-only). Keys carry a version; bumping it drops data
 * saved by older builds (the v1 keys held the old fictional demo data and are removed on load).
 * API mode: data is loaded from /api/bootstrap after login and every record the UI changes is
 * written back with PUT /api/<collection>/<id>; the server is the source of truth.
 */
export const STORAGE_KEYS={articles:'nexus.demo.articles.v2',todos:'nexus.demo.todos.v2',users:'nexus.demo.users.v2',programs:'nexus.demo.programs.v2',teams:'nexus.demo.teams.v2',students:'nexus.demo.students.v2',enrollments:'nexus.demo.enrollments.v2',courses:'nexus.demo.courses.v2',feedbacks:'nexus.demo.feedbacks.v2',assignments:'nexus.demo.assignments.v2',classTypes:'nexus.demo.class-types.v2',projects:'nexus.demo.projects.v2',opsCourses:'nexus.demo.ops-courses.v2',lessons:'nexus.demo.lessons.v2',lessonFeedbacks:'nexus.demo.lesson-feedbacks.v2'} as const;
export const LEGACY_KEYS=['nexus.demo.articles.v1','nexus.demo.student-health.v1','nexus.demo.todos.v1'];
function read(key:string){if(API_ENABLED||typeof window==='undefined')return null;try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null}catch{return null}}
function readList<T>(key:string,fallback:readonly T[]):T[]{const v=read(key);return Array.isArray(v)?v as T[]:fallback.slice()}
function write(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
if(typeof window!=='undefined'&&!API_ENABLED){try{LEGACY_KEYS.forEach(k=>localStorage.removeItem(k))}catch{/* storage unavailable */}}
type Bootstrap={user:ApiUser;programs:seed.Program[];teams:seed.Team[];students:seed.Student[];enrollments:seed.Enrollment[];courses:seed.Course[];feedbacks:seed.Feedback[];resources:FileRecord[];assignments:Assignment[];articles:ProgramArticle[];todos?:ApiTodo[];classTypes?:ClassType[];projects?:Project[];opsCourses?:OpsCourse[];lessons?:LessonRecord[];lessonFeedbacks?:LessonFeedback[];staff?:StaffMember[]};
/** Browser-only fields that never go to the API. */
const OMIT:Partial<Record<Collection,string[]>>={resources:['url']};
const idOf=(x:{id?:string;program?:string})=>(x.id??x.program) as string;
const asTodo=(t:ApiTodo):Todo=>({id:t.id,userId:t.userId,title:t.title,note:t.note??undefined,dueAt:t.dueAt??null,completedAt:t.completedAt??null,createdAt:t.createdAt,updatedAt:t.updatedAt});
const demoUser=(u:DirectoryUser):ApiUser=>({id:0,email:u.email,name:u.name,role:u.role,salesName:u.salesName,mustChangePassword:u.mustChange});
const asAdmin=(u:DirectoryUser,i:number):AdminUser=>({id:-(i+1),email:u.email,name:u.name,role:u.role,active:u.active,mustChangePassword:u.mustChange,salesName:u.salesName});
const apiError=(e:unknown,fallback:string)=>e instanceof ApiError?(e.message&&e.message!==e.code?e.message:e.status===403?'没有权限执行此操作':e.status===409?'该账号已存在':fallback):'无法连接服务器，请检查网络后重试';

export function Provider({children}:{children:ReactNode}){
 const [authenticated,setAuthenticated]=useState(false);
 const [role,setRole]=useState<Role>('sales');
 const [enrollments,setEnrollments]=useState(()=>readList(STORAGE_KEYS.enrollments,seed.enrollments));
 const [programs,setPrograms]=useState(()=>readList(STORAGE_KEYS.programs,seed.programs));
 const [students,setStudents]=useState(()=>readList<seed.Student>(STORAGE_KEYS.students,seed.students).filter(x=>x&&isHealth(x.health)));
 const [teams,setTeams]=useState(()=>readList(STORAGE_KEYS.teams,seed.teams));
 const [courses,setCourses]=useState(()=>readList(STORAGE_KEYS.courses,seed.courses));
 const [feedbacks,setFeedbacks]=useState(()=>readList(STORAGE_KEYS.feedbacks,seed.feedbacks));
 const [files,setFiles]=useState<FileRecord[]>(seed.resources);
 const [route,setRoute]=useState('dashboard'),[favorites,setFavorites]=useState<string[]>([]),[recent,setRecent]=useState<string[]>([]),[logs,setLogs]=useState<string[]>(['工作空间已就绪']);
 const [assignments,setAssignments]=useState<Assignment[]>(()=>readList(STORAGE_KEYS.assignments,[]));
 const [articles,setArticles]=useState<ProgramArticle[]>(()=>{const saved=read(STORAGE_KEYS.articles);return saved?mergeStoredArticles(seedArticles,saved):seedArticles});
 const [todos,setTodos]=useState<Todo[]>(()=>storedTodos(read(STORAGE_KEYS.todos)));
 const [classTypes,setClassTypes]=useState<ClassType[]>(()=>readList(STORAGE_KEYS.classTypes,defaultClassTypes));
 const [projects,setProjects]=useState<Project[]>(()=>readList(STORAGE_KEYS.projects,[]));
 const [opsCourses,setOpsCourses]=useState<OpsCourse[]>(()=>readList(STORAGE_KEYS.opsCourses,[]));
 const [lessons,setLessons]=useState<LessonRecord[]>(()=>readList(STORAGE_KEYS.lessons,[]));
 const [lessonFeedbacks,setLessonFeedbacks]=useState<LessonFeedback[]>(()=>readList(STORAGE_KEYS.lessonFeedbacks,[]));
 const [overrides,setOverrides]=useState<Overrides>(()=>{const v=read(STORAGE_KEYS.users);return v&&typeof v==='object'&&!Array.isArray(v)?v as Overrides:{}});
 const [apiStaff,setApiStaff]=useState<StaffMember[]>([]);
 const [persisted,setPersisted]=useState(true);
 const [user,setUser]=useState<ApiUser|null>(null);
 const [restoring,setRestoring]=useState(API_ENABLED);
 /** Last server-confirmed JSON per collection and record id (API mode only). */
 const synced=useRef<Partial<Record<Collection,Map<string,string>>>>({});
 const inflight=useRef(new Map<string,string>());
 const setters=useRef<Record<Collection,(list:never[])=>void>>({programs:setPrograms,teams:setTeams,students:setStudents,enrollments:setEnrollments,courses:setCourses,feedbacks:setFeedbacks,resources:setFiles,assignments:setAssignments,articles:setArticles,classTypes:setClassTypes,projects:setProjects,opsCourses:setOpsCourses,lessons:setLessons,lessonFeedbacks:setLessonFeedbacks} as never).current;
 const applyServer=useCallback((data:Bootstrap)=>{
  const sets:Record<Collection,unknown[]>={programs:data.programs,teams:data.teams,students:data.students,enrollments:data.enrollments,courses:data.courses,feedbacks:data.feedbacks,resources:data.resources,assignments:data.assignments,articles:data.articles,classTypes:data.classTypes??[],projects:data.projects??[],opsCourses:data.opsCourses??[],lessons:data.lessons??[],lessonFeedbacks:data.lessonFeedbacks??[]};
  for(const [name,list] of Object.entries(sets) as [Collection,{id?:string;program?:string}[]][]){synced.current[name]=new Map(list.map(x=>[idOf(x),stableJson(x,OMIT[name])]));}
  setPrograms(data.programs);setTeams(data.teams);setStudents(data.students);setEnrollments(data.enrollments);setCourses(data.courses);setFeedbacks(data.feedbacks);setAssignments(data.assignments);setArticles(data.articles);
  setClassTypes(data.classTypes??[]);setProjects(data.projects??[]);setOpsCourses(data.opsCourses??[]);setLessons(data.lessons??[]);setLessonFeedbacks(data.lessonFeedbacks??[]);setApiStaff(data.staff??[]);
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
    // Adopt server-side fields (e.g. 状态更新人/时间, computed 津贴) without re-sending.
    if(canonical!==body)(setters[name] as unknown as Dispatch<SetStateAction<{id?:string;program?:string}[]>>)(l=>l.map(x=>idOf(x)===idOf(record)?{...x,...record}:x));
   }).catch(e=>{setPersisted(false);toast.error(e instanceof ApiError&&e.status===403?'没有权限执行此操作，修改未保存':e instanceof ApiError&&e.status===400&&e.message&&e.message!==e.code?e.message:'保存到服务器失败，请稍后重试');if(e instanceof ApiError&&e.status===401){token.clear();setAuthenticated(false)}}).finally(()=>{if(inflight.current.get(key)===body)inflight.current.delete(key);if(!inflight.current.size)setTimeout(()=>{if(!inflight.current.size)void refresh()},50)});
  }
 },[refresh,setters]);
 const collections:[Collection,{id?:string;program?:string}[]][]=[['programs',programs],['teams',teams],['students',students],['enrollments',enrollments],['courses',courses],['feedbacks',feedbacks],['resources',files],['assignments',assignments],['articles',articles],['classTypes',classTypes],['projects',projects],['opsCourses',opsCourses],['lessons',lessons],['lessonFeedbacks',lessonFeedbacks]];
 for(const [name,list] of collections){
  // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed-length list, same order every render
  useEffect(()=>{if(authenticated)push(name,list)},[list,authenticated,push,name]);
 }
 // Demo mode: every collection except uploaded files is kept in localStorage.
 const demoPersist:[string,unknown][]=[[STORAGE_KEYS.programs,programs],[STORAGE_KEYS.teams,teams],[STORAGE_KEYS.students,students],[STORAGE_KEYS.enrollments,enrollments],[STORAGE_KEYS.courses,courses],[STORAGE_KEYS.feedbacks,feedbacks],[STORAGE_KEYS.assignments,assignments],[STORAGE_KEYS.classTypes,classTypes],[STORAGE_KEYS.projects,projects],[STORAGE_KEYS.opsCourses,opsCourses],[STORAGE_KEYS.lessons,lessons],[STORAGE_KEYS.lessonFeedbacks,lessonFeedbacks],[STORAGE_KEYS.users,overrides]];
 const first=useRef(true);
 for(const [key,value] of demoPersist){
  // eslint-disable-next-line react-hooks/rules-of-hooks, react-hooks/set-state-in-effect -- fixed-length list, same order every render; flags a localStorage quota failure
  useEffect(()=>{if(API_ENABLED||first.current)return;if(!write(key,value))setPersisted(false)},[key,value]);
 }
 useEffect(()=>{first.current=false},[]);
 /** Article changes come from ops actions; persist right away so a quota error can be reported in the editor. */
 const updateArticles=(fn:(list:ProgramArticle[])=>ProgramArticle[])=>{const next=fn(articles);setArticles(next);if(API_ENABLED)return true;const ok=write(STORAGE_KEYS.articles,next);setPersisted(ok);return ok};
 const login=async(email:string,password:string):Promise<LoginResult>=>{
  if(!API_ENABLED){
   let match:DirectoryUser|null=null;
   try{match=await authenticateDemo(email,password,overrides)}catch{return {ok:false,error:'当前浏览器不支持安全登录（需要 HTTPS），请更换浏览器后重试。'}}
   if(!match)return {ok:false,error:'账号或密码不正确，或账号已停用。'};
   setUser(demoUser(match));setRole(match.role);setAuthenticated(true);return {ok:true,role:match.role};
  }
  try{const res=await api.login(email,password);token.set(res.token);applyServer(await api.bootstrap<Bootstrap>());setAuthenticated(true);return {ok:true,role:res.user.role}}
  catch(e){token.clear();return {ok:false,error:e instanceof ApiError?(e.status===401?'账号或密码不正确，或账号已停用。':e.status===429?'尝试次数过多，请 10 分钟后再试。':'服务器暂时不可用，请稍后重试。'):'无法连接服务器，请检查网络后重试。'}}
 };
 const logout=()=>{token.clear();setUser(null);setAuthenticated(false)};
 // Any path that signs out (including setAuthenticated(false)) drops the session.
 const wasAuthed=useRef(false);
 useEffect(()=>{if(wasAuthed.current&&!authenticated){if(API_ENABLED)token.clear();setUser(null)}wasAuthed.current=authenticated},[authenticated]);
 const go=(s:string)=>{window.location.hash='/'+s;setRoute(s);window.scrollTo({top:0,behavior:'instant'});};
 useEffect(()=>{const change=()=>{setRoute(decodeURI(location.hash.replace(/^#\/?/,''))||'dashboard');window.scrollTo(0,0)};change();window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[]);

 const demoUserKey=()=>user?.email||'';
 const persistTodos=(list:Todo[])=>{if(API_ENABLED)return true;const ok=write(STORAGE_KEYS.todos,list);setPersisted(ok);return ok};
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

 const removeRecord=async(name:OpsCollection,id:string)=>{
  const drop=()=>(setters[name] as unknown as Dispatch<SetStateAction<{id:string}[]>>)(l=>l.filter(x=>x.id!==id));
  if(!API_ENABLED){drop();return true}
  try{await api.remove(name,id);synced.current[name]?.delete(id);drop();setPersisted(true);return true}
  catch(e){toast.error(e instanceof ApiError&&e.status===409?'该记录仍被其他数据引用，无法删除':apiError(e,'删除失败'));return false}
 };
 const staff=useMemo<StaffMember[]>(()=>API_ENABLED?apiStaff:directory(overrides).filter(u=>isOpsLike(u.role)).map(u=>({email:u.email,name:u.name,role:u.role,active:u.active})),[apiStaff,overrides]);
 const staffName=useCallback((email:string)=>staff.find(u=>u.email.toLowerCase()===String(email||'').toLowerCase())?.name||email||'未指定',[staff]);
 const changePassword=async(current:string,next:string)=>{
  const issues=passwordIssues(next);if(issues.length)return '新密码'+issues.join('，');
  if(current===next)return '新密码不能与当前密码相同';
  if(!user)return '请先登录';
  if(API_ENABLED){try{await api.changePassword(current,next);setUser(u=>u?{...u,mustChangePassword:false}:u);return null}catch(e){return e instanceof ApiError&&e.status===401?'当前密码不正确':apiError(e,'修改失败')}}
  const ok=await authenticateDemo(user.email,current,overrides).catch(()=>null);if(!ok)return '当前密码不正确';
  const h=await makeHash(next);setOverrides(o=>({...o,[user.email]:{...o[user.email],...h,mustChange:false}}));setUser(u=>u?{...u,mustChangePassword:false}:u);return null;
 };
 const admin:Store['admin']={
  list:async()=>{if(API_ENABLED)return (await api.adminUsers()).users;return directory(overrides).map(asAdmin)},
  create:async u=>{
   const email=u.email.trim().toLowerCase(),name=u.name.trim();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {ok:false,error:'请输入有效的登录账号（邮箱格式）'};
   if(!name)return {ok:false,error:'请填写姓名'};
   if(API_ENABLED){try{const r=await api.createUser({...u,email,name});setApiStaff(l=>isOpsLike(r.user.role)?[...l,{email:r.user.email,name:r.user.name,role:r.user.role,active:true}]:l);return {ok:true,password:r.password}}catch(e){return {ok:false,error:apiError(e,'创建失败')}}}
   if(directory(overrides).some(x=>x.email===email))return {ok:false,error:'该账号已存在'};
   const password=randomPassword();const h=await makeHash(password);
   setOverrides(o=>({...o,[email]:{created:true,name,role:u.role,active:true,mustChange:true,salesName:u.role==='sales'?(u.salesName||'顾问 '+name):null,...h}}));
   return {ok:true,password};
  },
  update:async(u,patch)=>{
   if(u.email===user?.email&&(patch.role&&patch.role!==u.role||patch.active===false))return '不能修改自己的角色或停用自己的账号';
   if(API_ENABLED){try{const r=await api.updateUser(u.id,patch);setApiStaff(l=>{const rest=l.filter(x=>x.email!==r.user.email);return isOpsLike(r.user.role)?[...rest,{email:r.user.email,name:r.user.name,role:r.user.role,active:r.user.active}]:rest});return null}catch(e){return apiError(e,'保存失败')}}
   setOverrides(o=>({...o,[u.email]:{...o[u.email],...patch}}));return null;
  },
  resetPassword:async u=>{
   if(API_ENABLED){try{return {ok:true,password:(await api.resetPassword(u.id)).password}}catch(e){return {ok:false,error:apiError(e,'重置失败')}}}
   const password=randomPassword();const h=await makeHash(password);setOverrides(o=>({...o,[u.email]:{...o[u.email],...h,mustChange:true}}));return {ok:true,password};
  },
 };
 return <Context.Provider value={{authenticated,setAuthenticated,enrollments,setEnrollments,role,setRole,programs,setPrograms,students,setStudents,teams,setTeams,courses,setCourses,feedbacks,setFeedbacks,files,setFiles,route,go,favorites,setFavorites,recent,setRecent,logs,log:(s)=>setLogs(v=>[s,...v]),assignments,setAssignments,articles,updateArticles,todos,addTodo,completeTodo,restoreTodo,deleteTodo,updateTodo,classTypes,setClassTypes,projects,setProjects,opsCourses,setOpsCourses,lessons,setLessons,lessonFeedbacks,setLessonFeedbacks,removeRecord,staff,staffName,changePassword,admin,persisted,apiMode:API_ENABLED,user,restoring,login,logout}}>{children}</Context.Provider>}
export const useNexus=()=>useContext(Context);
export function useVisible(){const s=useNexus();const salesName=s.user?.salesName||'';const students=s.students.filter(x=>s.role!=='sales'||x.sales===salesName);const teams=s.teams;return {students,teams,courses:s.courses.filter(c=>s.role!=='sales'||(teams.some(t=>t.id===c.team)&&s.programs.find(p=>p.id===c.program)?.published)),files:s.files.filter(f=>s.role!=='sales'||f.public),feedbacks:s.feedbacks.filter(f=>s.role!=='sales'||(f.visible&&students.some(x=>x.id===f.student)))};}
/** Display name of the signed-in user. */
export function useMe(){const s=useNexus();const name=s.user?.name||'';return {name,initial:name.slice(0,1)||'我',email:s.user?.email||''}}
