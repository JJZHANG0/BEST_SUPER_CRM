'use client';
import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import * as seed from './data';
import { seedArticles } from './article-seed';
import { mergeStoredArticles, type ProgramArticle } from './articles';
import { seedPosts } from './post-seed';
import { addMetrics, likedLocally, mergeStoredPosts, newPost, newSlug, readLocalMetrics, recordLocal, type ArticlePost, type LocalMetrics, type MetricKind, type PostMetrics } from './posts';
import { isHealth, type Assignment } from './students';
import { authenticateDemo, directory, makeHash, randomPassword, usernameTaken, migrateOverrides, type Overrides, type DirectoryUser } from './auth';
import { applyTheme, writeStoredTheme, readStoredTheme, isThemeId, DEFAULT_THEME, type ThemeId } from './themes';
import { isPetId, DEFAULT_PET, writeStoredPet, readStoredPet, type PetId } from './pets';
import { api, publicApi, visitorId, API_ENABLED, ApiError, token, stableJson, changedRecords, type ApiUser, type ApiTodo, type KpiReviewRow, type Collection, type OpsCollection, type StaffMember, type AdminUser } from './api';
import { storedTodos, newTodoId, type Todo } from './todos';
import { ownerView, teacherSave, reviewSheet, type KpiItem, type KpiReviewAction, type KpiSheet } from './kpi';
import { defaultClassTypes, type ClassType, type Project, type OpsCourse, type LessonRecord, type LessonFeedback, type Teacher, normalizeLesson, teacherRosterScope, opsOwnScope } from './ops';
import { realProjects, realCourses, realTeachers, realLessons, realLessonFeedbacks } from './real-seed';
import { rosterStudents, rosterTeams, rosterEnrollments } from './roster-seed';
import { isOpsLike, canAssignTodos, canAssignToLeader, canReviewKpi, canFillKpi, isLeader, passwordIssues, type Role, type Viewer, normalizeUsername, usernameIssue } from './roles';
import { dedupeSessions, type CourseSession } from './schedule';
import { salesOwns } from './sales';
import type { Announcement, AnnouncementAudience, AnnouncementDirectoryUser, AnnouncementReadRow } from './announcements';
export type FileRecord=seed.Resource & {url?:string};
export type LoginResult={ok:true;role:Role}|{ok:false;error:string};
type St<T>=Dispatch<SetStateAction<T>>;
export type Store={authenticated:boolean;setAuthenticated:St<boolean>;enrollments:seed.Enrollment[];setEnrollments:St<seed.Enrollment[]>;role:Role;setRole:St<Role>;programs:seed.Program[];setPrograms:St<seed.Program[]>;students:seed.Student[];setStudents:St<seed.Student[]>;teams:seed.Team[];setTeams:St<seed.Team[]>;teamLogs:seed.TeamLog[];setTeamLogs:St<seed.TeamLog[]>;courses:seed.Course[];setCourses:St<seed.Course[]>;feedbacks:seed.Feedback[];setFeedbacks:St<seed.Feedback[]>;files:FileRecord[];setFiles:St<FileRecord[]>;route:string;go:(route:string)=>void;favorites:string[];setFavorites:St<string[]>;recent:string[];setRecent:St<string[]>;logs:string[];log:(s:string)=>void;
  /** Homework / assignment records shown in student detail. */
  assignments:Assignment[];setAssignments:St<Assignment[]>;
  /** 项目书 (one per project): ops edit drafts and publish; sales read the published snapshot. */
  articles:ProgramArticle[];updateArticles:(fn:(list:ProgramArticle[])=>ProgramArticle[])=>boolean;
  /** 推文: many per project (draft → published → withdrawn). Sales only receive published snapshots. */
  posts:ArticlePost[];updatePosts:(fn:(list:ArticlePost[])=>ArticlePost[])=>boolean;
  /** New draft 推文 for a project, authored by the signed-in teacher; returns its id. */
  createPost:(program:string)=>string;
  /** Counters shown for a post (API: server counts; Pages preview: seed + this browser). */
  postMetrics:(p:ArticlePost)=>PostMetrics;
  /** Count a view / share / like (deduped per visitor). Resolves to the new counts, or null when it failed. */
  trackPost:(slug:string,kind:MetricKind)=>Promise<{counted:boolean;metrics:PostMetrics;liked:boolean}|null>;
  /** Pages preview: whether this browser already liked the post. */
  likedLocal:(slug:string)=>boolean;
  /** Personal todos for the signed-in user (ops homepage + 待办/已完成 pages). */
  todos:Todo[];
  /** Personal todo, or with `assignee` (an ops teacher's email) a task assigned by a superadmin. */
  addTodo:(input:{title:string;note?:string;dueAt?:string|null;assignee?:string|null})=>Promise<boolean>;
  /** Key of the signed-in user on todos / KPI sheets (API: users.id as text; demo: login email). */
  meKey:string;
  /** 当月绩效 (own sheet) and 绩效考核 (reviewer). */
  kpi:{load:(month:string)=>Promise<KpiSheet|null>;save:(month:string,items:KpiItem[],submit:boolean)=>Promise<{ok:true;sheet:KpiSheet}|{ok:false;error:string}>;reviewList:(month:string)=>Promise<KpiReviewRow[]>;review:(userKey:string,month:string,body:{items?:KpiItem[];reviewNote?:string;action:KpiReviewAction})=>Promise<{ok:true;sheet:KpiSheet}|{ok:false;error:string}>};
  completeTodo:(id:string)=>Promise<boolean>;
  restoreTodo:(id:string)=>Promise<boolean>;
  deleteTodo:(id:string)=>Promise<boolean>;
  updateTodo:(id:string,patch:{title?:string;note?:string|null;dueAt?:string|null})=>Promise<boolean>;
  /** 班型与津贴标准, 项目编号, 课程, 课时记录, 课情反馈. */
  classTypes:ClassType[];setClassTypes:St<ClassType[]>;
  projects:Project[];setProjects:St<Project[]>;
  /** 授课老师 directory (系统管理). */
  teachers:Teacher[];setTeachers:St<Teacher[]>;
  opsCourses:OpsCourse[];setOpsCourses:St<OpsCourse[]>;
  lessons:LessonRecord[];setLessons:St<LessonRecord[]>;
  lessonFeedbacks:LessonFeedback[];setLessonFeedbacks:St<LessonFeedback[]>;
  /** 课程排课: meetings of 课程安排 courses (weekly recurrence or manual dates). */
  courseSessions:CourseSession[];setCourseSessions:St<CourseSession[]>;
  /** 资料中心 folders (per programme). */
  resourceFolders:seed.ResourceFolder[];setResourceFolders:St<seed.ResourceFolder[]>;
  /** 项目公告 visible to the signed-in user (API) / local demo list. */
  announcements:Announcement[];
  unreadAnnouncements:number;
  createAnnouncement:(input:{title:string;body:string;tag?:string;program?:string|null;audience:AnnouncementAudience;recipientIds?:number[]})=>Promise<{ok:true;announcement:Announcement}|{ok:false;error:string}>;
  markAnnouncementRead:(id:string)=>Promise<boolean>;
  markAllAnnouncementsRead:()=>Promise<boolean>;
  loadAnnouncementReads:(id:string)=>Promise<{rows:AnnouncementReadRow[];error?:string}>;
  loadAnnouncementDirectory:()=>Promise<AnnouncementDirectoryUser[]>;
  /** YYYY-MM months whose 课时记录 are confirmed/locked (only 张捷嘉 may still edit). */
  lessonMonthLocks:string[];
  /** Hold-confirm a month: locks edits and notifies 张捷嘉 via 项目公告. */
  confirmLessonMonth:(month:string)=>Promise<{ok:true;already?:boolean}|{ok:false;error:string}>;
  /** Role + 部门负责人 flag, for the permission helpers in roles.ts. */

  viewer:Viewer;
  /** True for the 部门负责人 (only 张捷嘉). */
  leader:boolean;
  /** Delete one record of an ops collection (API: DELETE; demo: local). */
  removeRecord:(name:OpsCollection,id:string)=>Promise<boolean>;
  /** Ops teachers (教务老师) for pickers and name lookups. */
  staff:StaffMember[];staffName:(email:string)=>string;
  /** Upload / clear own avatar (≤256px square data URL on Pages; API stores on user). */
  updateAvatar:(dataUrl:string|null)=>Promise<string|null>;
  /** Apply accent theme (instant CSS + persist localStorage / API). */
  updateTheme:(id:ThemeId)=>Promise<string|null>;
  /** Preferred weather city for the workbench header. */
  updateWeatherCity:(city:string)=>Promise<string|null>;
  /** Floating desktop pet (rabbit|cat|carrot|pig). */
  updatePixelPet:(id:PetId)=>Promise<string|null>;
  /** Change the signed-in user's password. Resolves to an error message, or null on success. */
  changePassword:(current:string,next:string)=>Promise<string|null>;
  /** 系统管理 · 用户管理 (superadmin). */
  admin:{list:()=>Promise<AdminUser[]>;create:(u:{email:string;username:string;name:string;role:Role;salesName?:string|null;salesRegion?:string|null;salesLead?:boolean})=>Promise<{ok:true;password:string}|{ok:false;error:string}>;update:(u:AdminUser,patch:{name?:string;username?:string;role?:Role;active?:boolean;salesRegion?:string|null;salesLead?:boolean})=>Promise<string|null>;resetPassword:(u:AdminUser)=>Promise<{ok:true;password:string}|{ok:false;error:string}>};
  /** False when changes could not be saved (browser storage refused, or the API rejected them). */
  persisted:boolean;
  /** True when this build talks to the NEXUS API (shared database); false in the static demo. */
  /** Multi-role users: reopen the workspace as 运营端 or 教师端 (new token; teacher ACL applies in 教师端). */
  switchPortal:(p:'ops'|'teacher')=>Promise<string|null>;
  apiMode:boolean;user:ApiUser|null;
  /** True while a saved API session is being restored on page load. */
  restoring:boolean;
  login:(email:string,password:string)=>Promise<LoginResult>;logout:()=>void;
  /** 首次登录改密可「稍后修改」: true after skipping in this browser session; the next sign-in asks again. */
  passwordDeferred:boolean;deferPasswordChange:()=>void};
const Context=createContext<Store>(null!);
/**
 * Demo mode (no NEXT_PUBLIC_API_BASE, e.g. GitHub Pages): records are kept in this browser's
 * localStorage (uploaded files stay session-only). Keys carry a version; bumping it drops data
 * saved by older builds (the v1 keys held the old fictional demo data and are removed on load).
 * API mode: data is loaded from /api/bootstrap after login and every record the UI changes is
 * written back with PUT /api/<collection>/<id>; the server is the source of truth.
 */
export const STORAGE_KEYS={articles:'nexus.demo.articles.v2',posts:'nexus.demo.posts.v1',postMetrics:'nexus.demo.post-metrics.v1',todos:'nexus.demo.todos.v2',users:'nexus.demo.users.v3',programs:'nexus.demo.programs.v2',teams:'nexus.demo.teams.v3',teamLogs:'nexus.demo.team-logs.v1',students:'nexus.demo.students.v3',enrollments:'nexus.demo.enrollments.v3',courses:'nexus.demo.courses.v2',feedbacks:'nexus.demo.feedbacks.v2',assignments:'nexus.demo.assignments.v2',classTypes:'nexus.demo.class-types.v2',projects:'nexus.demo.projects.v3',teachers:'nexus.demo.teachers.v3',opsCourses:'nexus.demo.ops-courses.v3',lessons:'nexus.demo.lessons.v3',lessonFeedbacks:'nexus.demo.lesson-feedbacks.v3',courseSessions:'nexus.demo.course-sessions.v1',kpi:'nexus.demo.kpi.v1',announcements:'nexus.demo.announcements.v1',resourceFolders:'nexus.demo.resource-folders.v1',lessonMonthLocks:'nexus.demo.lesson-month-locks.v1'} as const;
/** v2 → v3 of 项目/课程/课时/课情反馈 loads the real data imported from the 运营部 spreadsheet (lib/nexus/real-seed.ts). */
export const LEGACY_KEYS=['nexus.demo.users.v2','nexus.demo.articles.v1','nexus.demo.student-health.v1','nexus.demo.todos.v1','nexus.demo.projects.v2','nexus.demo.ops-courses.v2','nexus.demo.lessons.v2','nexus.demo.lesson-feedbacks.v2','nexus.demo.students.v2','nexus.demo.teams.v2','nexus.demo.enrollments.v2'];
const PW_LATER_KEY='nexus.password-later.v1';
function read(key:string){if(API_ENABLED||typeof window==='undefined')return null;try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null}catch{return null}}
function readList<T>(key:string,fallback:readonly T[]):T[]{const v=read(key);return Array.isArray(v)?v as T[]:fallback.slice()}
function write(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
// users.v2 → v3: carry this browser's account overrides over, minus stale roles of demoted accounts (张雪航 → ops).
if(typeof window!=='undefined'&&!API_ENABLED){try{const old=localStorage.getItem('nexus.demo.users.v2');if(old&&!localStorage.getItem(STORAGE_KEYS.users))localStorage.setItem(STORAGE_KEYS.users,JSON.stringify(migrateOverrides(JSON.parse(old))))}catch{/* storage unavailable */}}
if(typeof window!=='undefined'&&!API_ENABLED){try{LEGACY_KEYS.forEach(k=>localStorage.removeItem(k))}catch{/* storage unavailable */}}
type Bootstrap={posts?:ArticlePost[];user:ApiUser;programs:seed.Program[];teams:seed.Team[];teamLogs?:seed.TeamLog[];students:seed.Student[];enrollments:seed.Enrollment[];courses:seed.Course[];feedbacks:seed.Feedback[];resources:FileRecord[];resourceFolders?:seed.ResourceFolder[];assignments:Assignment[];articles:ProgramArticle[];todos?:ApiTodo[];classTypes?:ClassType[];projects?:Project[];teachers?:Teacher[];opsCourses?:OpsCourse[];lessons?:LessonRecord[];lessonFeedbacks?:LessonFeedback[];staff?:StaffMember[];courseSessions?:CourseSession[];announcements?:Announcement[];lessonMonthLocks?:string[]};
/** Browser-only fields that never go to the API. */
const OMIT:Partial<Record<Collection,string[]>>={resources:['url']};
const idOf=(x:{id?:string;program?:string})=>(x.id??x.program) as string;
const asTodo=(t:ApiTodo):Todo=>({id:t.id,userId:t.userId,title:t.title,note:t.note??undefined,dueAt:t.dueAt??null,completedAt:t.completedAt??null,assignedBy:t.assignedBy??null,assignedByName:t.assignedByName??null,ownerName:t.ownerName??null,ownerEmail:t.ownerEmail??null,createdAt:t.createdAt,updatedAt:t.updatedAt});
const demoUser=(u:DirectoryUser):ApiUser=>({id:0,email:u.email,username:u.username,name:u.name,role:u.role,salesName:u.salesName,theme:DEFAULT_THEME,weatherCity:'杭州',pixelPet:DEFAULT_PET,mustChangePassword:u.mustChange,leader:u.leader,avatar:u.avatar??null});
const asAdmin=(u:DirectoryUser,i:number):AdminUser=>({id:-(i+1),email:u.email,username:u.username,name:u.name,role:u.role,active:u.active,mustChangePassword:u.mustChange,salesName:u.salesName,leader:u.leader,salesRegion:u.salesRegion??null,salesLead:u.salesLead===true});
const apiError=(e:unknown,fallback:string)=>e instanceof ApiError?(e.message&&e.message!==e.code?e.message:e.status===403?'没有权限执行此操作':e.status===409?'该账号已存在':fallback):'无法连接服务器，请检查网络后重试';

export function Provider({children}:{children:ReactNode}){
 const [authenticated,setAuthenticated]=useState(false);
 const [role,setRole]=useState<Role>('sales');
 const [enrollments,setEnrollments]=useState(()=>readList(STORAGE_KEYS.enrollments,API_ENABLED?seed.enrollments:rosterEnrollments));
 const [programs,setPrograms]=useState(()=>readList(STORAGE_KEYS.programs,seed.programs));
 const [students,setStudents]=useState(()=>readList<seed.Student>(STORAGE_KEYS.students,API_ENABLED?seed.students:rosterStudents).filter(x=>x&&isHealth(x.health)));
 const [teams,setTeams]=useState(()=>readList(STORAGE_KEYS.teams,API_ENABLED?seed.teams:rosterTeams));
 const [teamLogs,setTeamLogs]=useState<seed.TeamLog[]>(()=>readList(STORAGE_KEYS.teamLogs,[]));
 const [courses,setCourses]=useState(()=>readList(STORAGE_KEYS.courses,seed.courses));
 const [feedbacks,setFeedbacks]=useState(()=>readList(STORAGE_KEYS.feedbacks,seed.feedbacks));
 const [files,setFiles]=useState<FileRecord[]>(seed.resources);
 const [route,setRoute]=useState('dashboard'),[favorites,setFavorites]=useState<string[]>([]),[recent,setRecent]=useState<string[]>([]),[logs,setLogs]=useState<string[]>(['工作空间已就绪']);
 const [assignments,setAssignments]=useState<Assignment[]>(()=>readList(STORAGE_KEYS.assignments,[]));
 const [articles,setArticles]=useState<ProgramArticle[]>(()=>{const saved=read(STORAGE_KEYS.articles);return saved?mergeStoredArticles(seedArticles,saved):seedArticles});
 const [posts,setPosts]=useState<ArticlePost[]>(()=>API_ENABLED?[]:mergeStoredPosts(seedPosts,read(STORAGE_KEYS.posts)));
 const [localMetrics,setLocalMetrics]=useState<LocalMetrics>(()=>readLocalMetrics(read(STORAGE_KEYS.postMetrics)));
 const [todos,setTodos]=useState<Todo[]>(()=>storedTodos(read(STORAGE_KEYS.todos)));
 const [kpiSheets,setKpiSheets]=useState<KpiSheet[]>(()=>readList<KpiSheet>(STORAGE_KEYS.kpi,[]).filter(x=>x&&typeof x==='object'&&typeof x.userKey==='string'&&typeof x.month==='string'&&Array.isArray(x.items)));
 const [classTypes,setClassTypes]=useState<ClassType[]>(()=>readList(STORAGE_KEYS.classTypes,defaultClassTypes));
 const [projects,setProjects]=useState<Project[]>(()=>API_ENABLED?[]:readList(STORAGE_KEYS.projects,realProjects));
 const [teachers,setTeachers]=useState<Teacher[]>(()=>API_ENABLED?[]:readList(STORAGE_KEYS.teachers,realTeachers));
 const [opsCourses,setOpsCourses]=useState<OpsCourse[]>(()=>API_ENABLED?[]:readList(STORAGE_KEYS.opsCourses,realCourses));
 const [lessons,setLessons]=useState<LessonRecord[]>(()=>API_ENABLED?[]:readList<LessonRecord>(STORAGE_KEYS.lessons,realLessons as LessonRecord[]).map(normalizeLesson));
 const [lessonFeedbacks,setLessonFeedbacks]=useState<LessonFeedback[]>(()=>API_ENABLED?[]:readList(STORAGE_KEYS.lessonFeedbacks,realLessonFeedbacks));
 const [courseSessions,setCourseSessions]=useState<CourseSession[]>(()=>API_ENABLED?[]:readList(STORAGE_KEYS.courseSessions,[]));
 const [resourceFolders,setResourceFolders]=useState<seed.ResourceFolder[]>(()=>API_ENABLED?[]:readList(STORAGE_KEYS.resourceFolders,[]));
 const [announcements,setAnnouncements]=useState<Announcement[]>(()=>API_ENABLED?[]:readList(STORAGE_KEYS.announcements,[]));
 const [lessonMonthLocks,setLessonMonthLocks]=useState<string[]>(()=>API_ENABLED?[]:readList<string>(STORAGE_KEYS.lessonMonthLocks,[]));
 const [passwordDeferred,setPasswordDeferred]=useState(false);
 const [overrides,setOverrides]=useState<Overrides>(()=>{const v=read(STORAGE_KEYS.users);return v&&typeof v==='object'&&!Array.isArray(v)?v as Overrides:{}});
 const [apiStaff,setApiStaff]=useState<StaffMember[]>([]);
 const [persisted,setPersisted]=useState(true);
 const [user,setUser]=useState<ApiUser|null>(null);
 const [restoring,setRestoring]=useState(API_ENABLED);
 /** Last server-confirmed JSON per collection and record id (API mode only). */
 const synced=useRef<Partial<Record<Collection,Map<string,string>>>>({});
 const inflight=useRef(new Map<string,string>());
 const setters=useRef<Record<Collection,(list:never[])=>void>>({programs:setPrograms,teams:setTeams,teamLogs:setTeamLogs,students:setStudents,enrollments:setEnrollments,courses:setCourses,feedbacks:setFeedbacks,resources:setFiles,assignments:setAssignments,articles:setArticles,posts:setPosts,classTypes:setClassTypes,projects:setProjects,teachers:setTeachers,opsCourses:setOpsCourses,lessons:setLessons,lessonFeedbacks:setLessonFeedbacks,courseSessions:setCourseSessions,resourceFolders:setResourceFolders} as never).current;
 const applyServer=useCallback((data:Bootstrap)=>{
  const sets:Record<Collection,unknown[]>={programs:data.programs,teams:data.teams,teamLogs:data.teamLogs??[],students:data.students,enrollments:data.enrollments,courses:data.courses,feedbacks:data.feedbacks,resources:data.resources,assignments:data.assignments,articles:data.articles,posts:data.posts??[],classTypes:data.classTypes??[],projects:data.projects??[],teachers:data.teachers??[],opsCourses:data.opsCourses??[],lessons:(data.lessons??[]).map(normalizeLesson),lessonFeedbacks:data.lessonFeedbacks??[],courseSessions:data.courseSessions??[],resourceFolders:data.resourceFolders??[]};
  for(const [name,list] of Object.entries(sets) as [Collection,{id?:string;program?:string}[]][]){synced.current[name]=new Map(list.map(x=>[idOf(x),stableJson(x,OMIT[name])]));}
  setPrograms(data.programs);setTeams(data.teams);setTeamLogs(data.teamLogs??[]);setStudents(data.students);setEnrollments(data.enrollments);setCourses(data.courses);setFeedbacks(data.feedbacks);setAssignments(data.assignments);setArticles(data.articles);setPosts(data.posts??[]);
  setClassTypes(data.classTypes??[]);setProjects(data.projects??[]);setTeachers(data.teachers??[]);setOpsCourses(data.opsCourses??[]);setLessons((data.lessons??[]).map(normalizeLesson));setLessonFeedbacks(data.lessonFeedbacks??[]);setCourseSessions(data.courseSessions??[]);setResourceFolders(data.resourceFolders??[]);setAnnouncements(data.announcements??[]);setLessonMonthLocks(data.lessonMonthLocks??[]);setApiStaff(data.staff??[]);
  // Keep blob URLs of files uploaded in this tab.
  setFiles(prev=>data.resources.map(r=>({...r,url:prev.find(p=>p.id===r.id)?.url})));
  setUser(data.user);setRole(data.user.role);applyTheme(isThemeId(data.user.theme)?data.user.theme:(readStoredTheme()||DEFAULT_THEME));writeStoredPet(isPetId(data.user.pixelPet)?data.user.pixelPet:DEFAULT_PET);
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
   }).catch(e=>{setPersisted(false);toast.error(e instanceof ApiError&&e.status===403?'没有权限执行此操作，修改未保存':e instanceof ApiError&&(e.status===400||e.status===409)&&e.message&&e.message!==e.code?e.message:'保存到服务器失败，请稍后重试');if(e instanceof ApiError&&e.status===401){token.clear();setAuthenticated(false)}}).finally(()=>{if(inflight.current.get(key)===body)inflight.current.delete(key);if(!inflight.current.size)setTimeout(()=>{if(!inflight.current.size)void refresh()},50)});
  }
 },[refresh,setters]);
 const collections:[Collection,{id?:string;program?:string}[]][]=[['programs',programs],['teams',teams],['teamLogs',teamLogs],['students',students],['enrollments',enrollments],['courses',courses],['feedbacks',feedbacks],['resources',files],['assignments',assignments],['articles',articles],['posts',posts],['classTypes',classTypes],['projects',projects],['teachers',teachers],['opsCourses',opsCourses],['lessons',lessons],['lessonFeedbacks',lessonFeedbacks],['courseSessions',courseSessions],['resourceFolders',resourceFolders]];
 for(const [name,list] of collections){
  // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed-length list, same order every render
  useEffect(()=>{if(authenticated)push(name,list)},[list,authenticated,push,name]);
 }
 // Demo mode: every collection except uploaded files is kept in localStorage.
 const demoPersist:[string,unknown][]=[[STORAGE_KEYS.programs,programs],[STORAGE_KEYS.teams,teams],[STORAGE_KEYS.teamLogs,teamLogs],[STORAGE_KEYS.students,students],[STORAGE_KEYS.enrollments,enrollments],[STORAGE_KEYS.courses,courses],[STORAGE_KEYS.feedbacks,feedbacks],[STORAGE_KEYS.assignments,assignments],[STORAGE_KEYS.classTypes,classTypes],[STORAGE_KEYS.projects,projects],[STORAGE_KEYS.teachers,teachers],[STORAGE_KEYS.opsCourses,opsCourses],[STORAGE_KEYS.lessons,lessons],[STORAGE_KEYS.lessonFeedbacks,lessonFeedbacks],[STORAGE_KEYS.courseSessions,courseSessions],[STORAGE_KEYS.resourceFolders,resourceFolders],[STORAGE_KEYS.announcements,announcements],[STORAGE_KEYS.lessonMonthLocks,lessonMonthLocks],[STORAGE_KEYS.users,overrides]];
 const first=useRef(true);
 for(const [key,value] of demoPersist){
  // eslint-disable-next-line react-hooks/rules-of-hooks, react-hooks/set-state-in-effect -- fixed-length list, same order every render; flags a localStorage quota failure
  useEffect(()=>{if(API_ENABLED||first.current)return;if(!write(key,value))setPersisted(false)},[key,value]);
 }
 useEffect(()=>{first.current=false},[]);
 /** Article changes come from ops actions; persist right away so a quota error can be reported in the editor. */
 const updateArticles=(fn:(list:ProgramArticle[])=>ProgramArticle[])=>{const next=fn(articles);setArticles(next);if(API_ENABLED)return true;const ok=write(STORAGE_KEYS.articles,next);setPersisted(ok);return ok};
 const updatePosts=(fn:(list:ArticlePost[])=>ArticlePost[])=>{const next=fn(posts);setPosts(next);if(API_ENABLED)return true;const ok=write(STORAGE_KEYS.posts,next);setPersisted(ok);return ok};
 const createPost=(program:string)=>{
  const now=(()=>{const d=new Date(),pad=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`})();
  const id='POST-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
  const name=user?.name||'';
  const p=newPost({id,slug:newSlug(program,posts.map(x=>x.slug)),program,author:name?name+'老师':'',authorEmail:user?.email||'',now});
  updatePosts(l=>[p,...l]);return id;
 };
 const postMetrics=(p:ArticlePost)=>API_ENABLED?p.metrics:addMetrics(p.metrics,localMetrics.counts[p.slug]);
 const likedLocal=(slug:string)=>likedLocally(localMetrics,slug);
 const trackPost=async(slug:string,kind:MetricKind)=>{
  if(API_ENABLED){try{const r=await publicApi.track(slug,kind,visitorId());setPosts(l=>l.map(p=>p.slug===slug?{...p,metrics:r.metrics}:p));return r}catch{return null}}
  const p=posts.find(x=>x.slug===slug);if(!p)return null;
  const r=recordLocal(localMetrics,slug,kind,Date.now());
  if(r.counted){setLocalMetrics(r.state);write(STORAGE_KEYS.postMetrics,r.state)}
  return {counted:r.counted,metrics:addMetrics(p.metrics,r.state.counts[slug]),liked:likedLocally(r.state,slug)};
 };
 const login=async(identifier:string,password:string):Promise<LoginResult>=>{
  const email=identifier.trim();
  if(!API_ENABLED){
   let match:DirectoryUser|null=null;
   try{match=await authenticateDemo(email,password,overrides)}catch{return {ok:false,error:'当前浏览器不支持安全登录（需要 HTTPS），请更换浏览器后重试。'}}
   if(!match)return {ok:false,error:'账号或密码不正确，或账号已停用。'};
   clearPwLater();const du=demoUser(match);const ov=overrides[match.email];const th=isThemeId(ov?.theme)?ov!.theme as ThemeId:(readStoredTheme()||DEFAULT_THEME);applyTheme(th);const pet=isPetId(ov?.pixelPet)?ov!.pixelPet as PetId:(readStoredPet()||DEFAULT_PET);writeStoredPet(pet);setUser({...du,theme:th,weatherCity:ov?.weatherCity||du.weatherCity||'杭州',pixelPet:pet,avatar:ov?.avatar??du.avatar});setRole(match.role);setAuthenticated(true);return {ok:true,role:match.role};
  }
  try{const res=await api.login(email,password,role==='sales'?'sales':role==='teacher'?'teacher':'ops');clearPwLater();token.set(res.token);applyServer(await api.bootstrap<Bootstrap>());setAuthenticated(true);return {ok:true,role:res.user.role}}
  catch(e){token.clear();return {ok:false,error:e instanceof ApiError?(e.status===403?(e.message&&!/^HTTP|forbidden|portal_denied/.test(e.message)?e.message:'该账号没有所选登录身份，请选择正确的身份后再登录。'):e.status===401?'账号或密码不正确，或账号已停用。':e.status===429?'尝试次数过多，请 10 分钟后再试。':'服务器暂时不可用，请稍后重试。'):'无法连接服务器，请检查网络后重试。'}}
 };
 const logout=()=>{token.clear();clearPwLater();setUser(null);setAuthenticated(false)};
 // 「稍后修改」 lasts for this browser session only (sessionStorage); every explicit sign-in asks again.
 function clearPwLater(){setPasswordDeferred(false);try{sessionStorage.removeItem(PW_LATER_KEY)}catch{/* ignore */}}
 const deferPasswordChange=()=>{setPasswordDeferred(true);try{sessionStorage.setItem(PW_LATER_KEY,String(user?.email||''))}catch{/* session-only */}};
 // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the per-session skip after a reload
 useEffect(()=>{if(!user?.email)return;try{setPasswordDeferred(sessionStorage.getItem(PW_LATER_KEY)===user.email)}catch{/* ignore */}},[user?.email]);
 // Any path that signs out (including setAuthenticated(false)) drops the session.
 const wasAuthed=useRef(false);
 useEffect(()=>{applyTheme(readStoredTheme()||DEFAULT_THEME)},[]);
 useEffect(()=>{if(wasAuthed.current&&!authenticated){if(API_ENABLED)token.clear();setUser(null)}wasAuthed.current=authenticated},[authenticated]);
 const go=(s:string)=>{window.location.hash='/'+s;setRoute(s);window.scrollTo({top:0,behavior:'instant'});};
 useEffect(()=>{const change=()=>{setRoute(decodeURI(location.hash.replace(/^#\/?/,''))||'dashboard');window.scrollTo(0,0)};change();window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[]);

 const viewer=useMemo<Viewer>(()=>({role,leader:user?.leader===true}),[role,user?.leader]);
 const leader=isLeader(viewer);
 const demoUserKey=()=>user?.email||'';
 const persistTodos=(list:Todo[])=>{if(API_ENABLED)return true;const ok=write(STORAGE_KEYS.todos,list);setPersisted(ok);return ok};
 const addTodo=async(input:{title:string;note?:string;dueAt?:string|null;assignee?:string|null})=>{
  const title=input.title.trim();if(!title)return false;
  const assignee=(input.assignee||'').trim().toLowerCase();
  const assigning=!!assignee&&assignee!==String(user?.email||'').toLowerCase();
  const upward=assigning&&!canAssignTodos(viewer);
  if(upward&&!canAssignToLeader(viewer)){toast.error('只有部门负责人可以指派任务');return false}
  if(API_ENABLED){try{const {todo}=await api.createTodo({title,note:input.note??null,dueAt:input.dueAt??null,...(assigning?{assignee}:{})});setTodos(l=>[asTodo(todo),...l]);setPersisted(true);return true}catch(e){setPersisted(false);toast.error(e instanceof ApiError?apiError(e,'保存待办失败'):'无法连接服务器');return false}}
  const now=new Date().toISOString();
  const target=assigning?directory(overrides).find(u=>u.email===assignee&&u.active&&isOpsLike(u.role)):null;
  if(assigning&&!target){toast.error('请选择在职的运营老师');return false}
  if(upward&&!target?.leader){toast.error('只能给张捷嘉老师布置工作');return false}
  const item:Todo={id:newTodoId(),userId:assigning?assignee:demoUserKey(),title,note:input.note?.trim()||undefined,dueAt:input.dueAt??null,completedAt:null,...(assigning?{assignedBy:demoUserKey(),assignedByName:user?.name||'',ownerName:target!.name,ownerEmail:assignee}:{}),createdAt:now,updatedAt:now};
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

 const meKey=API_ENABLED?String(user?.id??''):String(user?.email||'').toLowerCase();
 const persistKpi=(list:KpiSheet[])=>{setKpiSheets(list);if(API_ENABLED)return true;const ok=write(STORAGE_KEYS.kpi,list);setPersisted(ok);return ok};
 const kpi:Store['kpi']={
  load:async month=>{
   if(!canFillKpi(viewer))return null;
   if(API_ENABLED){try{return (await api.kpi(month)).sheet}catch(e){toast.error(apiError(e,'读取绩效失败'));return null}}
   const own=kpiSheets.find(x=>x.userKey===meKey&&x.month===month);return own?ownerView(own):null;
  },
  save:async(month,items,submit)=>{
   if(!canFillKpi(viewer))return {ok:false,error:'部门负责人不填写当月绩效'};
   if(API_ENABLED){try{return {ok:true,sheet:(await api.saveKpi(month,items,submit)).sheet}}catch(e){return {ok:false,error:apiError(e,'保存失败')}}}
   const current=kpiSheets.find(x=>x.userKey===meKey&&x.month===month)??null;
   const r=teacherSave(current,{id:'KPI-'+meKey+'-'+month,userKey:meKey,userName:user?.name||'',month},items,submit);
   if(!r.ok)return {ok:false,error:r.error};
   if(!persistKpi([...kpiSheets.filter(x=>x!==current),r.sheet]))return {ok:false,error:'浏览器存储空间不足，未能保存'};
   return {ok:true,sheet:ownerView(r.sheet)};
  },
  reviewList:async month=>{
   if(!canReviewKpi(viewer))return [];
   if(API_ENABLED){try{return (await api.kpiReview(month)).rows}catch(e){toast.error(apiError(e,'读取绩效失败'));return []}}
   const people=directory(overrides);const sheets=kpiSheets.filter(x=>x.month===month);
   // Everyone who fills 当月绩效 (ops-workspace, not the 部门负责人), plus anyone with a sheet.
   return people.filter(u=>u.email.toLowerCase()!==meKey.toLowerCase()&&!u.leader&&((isOpsLike(u.role)&&u.active)||sheets.some(x=>x.userKey===u.email))).map(u=>({user:{key:u.email,name:u.name,email:u.email,role:u.role},sheet:sheets.find(x=>x.userKey===u.email)??null}));
  },
  review:async(userKey,month,body)=>{
   if(!canReviewKpi(viewer))return {ok:false,error:'此操作仅部门负责人可用'};
   if(API_ENABLED){try{return {ok:true,sheet:(await api.reviewKpi(userKey,month,body)).sheet}}catch(e){return {ok:false,error:apiError(e,'保存失败')}}}
   const current=kpiSheets.find(x=>x.userKey===userKey&&x.month===month)??null;
   const r=reviewSheet(current,{...body,reviewerKey:meKey,reviewerName:user?.name||''});
   if(!r.ok)return {ok:false,error:r.error};
   if(!persistKpi(kpiSheets.map(x=>x===current?r.sheet:x)))return {ok:false,error:'浏览器存储空间不足，未能保存'};
   return {ok:true,sheet:r.sheet};
  },
 };
 const unreadAnnouncements = announcements.filter(a => !a.read).length;
 const createAnnouncement = async (input: { title: string; body: string; tag?: string; program?: string | null; audience: AnnouncementAudience; recipientIds?: number[] }) => {
  if (API_ENABLED) {
    try {
      const { announcement } = await api.createAnnouncement(input);
      setAnnouncements(l => [announcement, ...l]);
      setPersisted(true);
      return { ok: true as const, announcement };
    } catch (e) { return { ok: false as const, error: apiError(e, '发布公告失败') }; }
  }
  const now = new Date();
  const stamp = (() => { const pad = (n: number) => String(n).padStart(2, '0'); return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`; })();
  const a: Announcement = {
    id: 'ANN-' + Date.now().toString(36).toUpperCase(), title: input.title.trim(), body: input.body.trim(), tag: input.tag?.trim() || '公告',
    program: input.program || null, audience: input.audience, recipientIds: input.recipientIds || [],
    authorId: user?.id || 0, authorName: user?.name || '我', date: stamp, createdAt: now.toISOString(),
    read: true, readCount: 1, recipientCount: (input.recipientIds || []).length || 1,
  };
  setAnnouncements(l => { const next = [a, ...l]; write(STORAGE_KEYS.announcements, next); return next; });
  return { ok: true as const, announcement: a };
 };
 const markAnnouncementRead = async (id: string) => {
  if (API_ENABLED) {
    try { await api.markAnnouncementRead(id); setAnnouncements(l => l.map(a => a.id === id ? { ...a, read: true } : a)); return true; }
    catch { toast.error('标记已读失败'); return false; }
  }
  setAnnouncements(l => { const next = l.map(a => a.id === id ? { ...a, read: true } : a); write(STORAGE_KEYS.announcements, next); return next; });
  return true;
 };
 const markAllAnnouncementsRead = async () => {
  if (API_ENABLED) {
    try { await api.markAllAnnouncementsRead(); setAnnouncements(l => l.map(a => ({ ...a, read: true }))); return true; }
    catch { toast.error('标记已读失败'); return false; }
  }
  setAnnouncements(l => { const next = l.map(a => ({ ...a, read: true })); write(STORAGE_KEYS.announcements, next); return next; });
  return true;
 };
 const loadAnnouncementReads = async (id: string) => {
  if (API_ENABLED) {
    try { return { rows: (await api.announcementReads(id)).rows }; }
    catch (e) { return { rows: [], error: apiError(e, '无法加载已读名单') }; }
  }
  const a = announcements.find(x => x.id === id);
  if (!a) return { rows: [], error: '公告不存在' };
  return { rows: [{ userId: a.authorId, name: a.authorName, email: user?.email || '', role: role, read: true, readAt: a.createdAt }] };
 };
 const loadAnnouncementDirectory = async () => {
  if (API_ENABLED) {
    try { return (await api.announcementDirectory()).users; }
    catch { toast.error('无法加载留言对象'); return []; }
  }
  return directory(overrides).filter(u => u.active).map((u, i) => ({ id: -(i + 1), name: u.name, email: u.email, role: u.role }));
 };

 const confirmLessonMonth = async (month: string) => {
  const m = (month || '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return { ok: false as const, error: '请选择有效月份' };
  if (API_ENABLED) {
    try {
      const res = await api.confirmLessonMonth(m);
      setLessonMonthLocks(l => l.includes(m) ? l : [...l, m].sort());
      if (res.announcement) setAnnouncements(l => l.some(a => a.id === res.announcement!.id) ? l : [res.announcement!, ...l]);
      setPersisted(true);
      return { ok: true as const, already: res.already };
    } catch (e) { return { ok: false as const, error: apiError(e, '确认失败') }; }
  }
  if (lessonMonthLocks.includes(m)) return { ok: true as const, already: true };
  const next = [...lessonMonthLocks, m].sort();
  setLessonMonthLocks(next);
  write(STORAGE_KEYS.lessonMonthLocks, next);
  // Demo: directed note to 张捷嘉
  const dir = directory(overrides);
  const leader = dir.find(u => u.name === '张捷嘉' || u.leader) || dir[0];
  const leaderId = leader ? -(dir.indexOf(leader) + 1) : -1;
  const now = new Date();
  const stamp = (() => { const pad = (n: number) => String(n).padStart(2, '0'); return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`; })();
  const [y, mo] = m.split('-');
  const label = `${y}年${Number(mo)}月`;
  const a: Announcement = {
    id: 'ANN-' + Date.now().toString(36).toUpperCase(), title: `${label}授课老师课时已确认`,
    body: `${user?.name || '运营'} 已确认 ${label} 的授课老师课时无误，该月课时记录已锁定（仅张捷嘉可再修改）。`,
    tag: '课时确认', program: null, audience: 'selected', recipientIds: leaderId < 0 ? [leaderId] : [],
    authorId: user?.id || 0, authorName: user?.name || '我', date: stamp, createdAt: now.toISOString(),
    read: true, readCount: 1, recipientCount: 1,
  };
  setAnnouncements(l => { const n = [a, ...l]; write(STORAGE_KEYS.announcements, n); return n; });
  return { ok: true as const, already: false };
 };

  const removeRecord=async(name:OpsCollection,id:string)=>{
  const drop=()=>{
    (setters[name] as unknown as Dispatch<SetStateAction<{id:string}[]>>)(l=>l.filter(x=>x.id!==id));
    // Deleting a 课程安排 course also drops its 排课 sessions locally (API cascades too).
    if(name==='courses')setCourseSessions(l=>l.filter(x=>x.course!==id));
    if(name==='resourceFolders')setFiles(l=>l.map(f=>f.folder===id?{...f,folder:undefined}:f));
  };
  if(!API_ENABLED){drop();return true}
  try{await api.remove(name,id);synced.current[name]?.delete(id);drop();setPersisted(true);return true}
  catch(e){toast.error(e instanceof ApiError&&e.status===409?'该记录仍被其他数据引用，无法删除':apiError(e,'删除失败'));return false}
 };
 const staff=useMemo<StaffMember[]>(()=>API_ENABLED?apiStaff:directory(overrides).filter(u=>isOpsLike(u.role)).map(u=>({email:u.email,name:u.name,role:u.role,active:u.active,leader:u.leader})),[apiStaff,overrides]);
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
   const email=u.email.trim().toLowerCase(),name=u.name.trim().replace(/\s+/g,' '),username=normalizeUsername(u.username||name);
   if(!name)return {ok:false,error:'请填写姓名'};
   const ui=usernameIssue(username);if(ui)return {ok:false,error:ui};
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {ok:false,error:'请输入有效的邮箱（作为备用登录账号）'};
   if(API_ENABLED){try{const r=await api.createUser({...u,email,name,username});setApiStaff(l=>isOpsLike(r.user.role)?[...l,{email:r.user.email,name:r.user.name,role:r.user.role,active:true}]:l);return {ok:true,password:r.password}}catch(e){return {ok:false,error:apiError(e,'创建失败')}}}
   if(directory(overrides).some(x=>x.email===email))return {ok:false,error:'该邮箱已被使用'};
   if(usernameTaken(username,overrides))return {ok:false,error:'该用户名已被使用'};
   const password=randomPassword();const h=await makeHash(password);
   setOverrides(o=>({...o,[email]:{created:true,name,username,role:u.role,active:true,mustChange:true,salesName:u.role==='sales'?(u.salesName||'顾问 '+name):null,salesRegion:u.salesRegion??null,salesLead:u.salesLead===true,...(u.role==='sales'?{theme:'ice'}:u.role==='teacher'?{theme:'steel'}:{}),...h}}));
   return {ok:true,password};
  },
  update:async(u,patch)=>{
   if(u.email===user?.email&&(patch.role&&patch.role!==u.role||patch.active===false))return '不能修改自己的角色或停用自己的账号';
   if(patch.username!==undefined){const un=normalizeUsername(patch.username);const ui=usernameIssue(un);if(ui)return ui;if(!API_ENABLED&&usernameTaken(un,overrides,u.email))return '该用户名已被使用';patch={...patch,username:un}}
   if(patch.name!==undefined){patch={...patch,name:patch.name.trim().replace(/\s+/g,' ')};if(!patch.name)return '请填写姓名'}
   if(API_ENABLED){try{const r=await api.updateUser(u.id,patch);setApiStaff(l=>{const rest=l.filter(x=>x.email!==r.user.email);return isOpsLike(r.user.role)?[...rest,{email:r.user.email,name:r.user.name,role:r.user.role,active:r.user.active}]:rest});return null}catch(e){return apiError(e,'保存失败')}}
   setOverrides(o=>({...o,[u.email]:{...o[u.email],...patch}}));return null;
  },
  resetPassword:async u=>{
   if(API_ENABLED){try{return {ok:true,password:(await api.resetPassword(u.id)).password}}catch(e){return {ok:false,error:apiError(e,'重置失败')}}}
   const password=randomPassword();const h=await makeHash(password);setOverrides(o=>({...o,[u.email]:{...o[u.email],...h,mustChange:true}}));return {ok:true,password};
  },
 };
  const updateAvatar=async(dataUrl:string|null):Promise<string|null>=>{
  if(!user)return '请先登录';
  if(dataUrl&&(dataUrl.length>900_000||!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)))return '头像需为 PNG/JPEG/WebP，且不超过约 256×256';
  if(API_ENABLED){try{const r=await api.updateAvatar(dataUrl);setUser(u=>u?{...u,avatar:r.user.avatar??null}:u);return null}catch(e){return apiError(e,'头像保存失败')}}
  const key=user.email;const next={...overrides,[key]:{...(overrides[key]||{}),avatar:dataUrl}};setOverrides(next);setUser(u=>u?{...u,avatar:dataUrl}:u);write(STORAGE_KEYS.users,next);return null;
 };
  const updateTheme=async(id:ThemeId):Promise<string|null>=>{
  if(!isThemeId(id))return '无效的主题';
  applyTheme(id);writeStoredTheme(id);
  if(!user)return null;
  if(API_ENABLED){try{const r=await api.updateTheme(id);setUser(u=>u?{...u,theme:r.user.theme??id}:u);return null}catch(e){return apiError(e,'主题保存失败')}}
  const key=user.email;const next={...overrides,[key]:{...(overrides[key]||{}),theme:id}};setOverrides(next);setUser(u=>u?{...u,theme:id}:u);write(STORAGE_KEYS.users,next);return null;
 };
  const updateWeatherCity=async(city:string):Promise<string|null>=>{
  const cleaned=(city||'').trim().replace(/\s+/g,' ').slice(0,40);
  if(!cleaned)return '请填写城市名称';
  if(!user)return '请先登录';
  if(API_ENABLED){try{const r=await api.updateWeatherCity(cleaned);setUser(u=>u?{...u,weatherCity:r.user.weatherCity??cleaned}:u);return null}catch(e){return apiError(e,'天气城市保存失败')}}
  const key=user.email;const next={...overrides,[key]:{...(overrides[key]||{}),weatherCity:cleaned}};setOverrides(next);setUser(u=>u?{...u,weatherCity:cleaned}:u);write(STORAGE_KEYS.users,next);return null;
 };
  const updatePixelPet=async(id:PetId):Promise<string|null>=>{
  if(!isPetId(id))return '无效的桌宠';
  writeStoredPet(id);
  if(!user)return null;
  if(API_ENABLED){try{const r=await api.updatePixelPet(id);setUser(u=>u?{...u,pixelPet:r.user.pixelPet??id}:u);return null}catch(e){return apiError(e,'桌宠保存失败')}}
  const key=user.email;const next={...overrides,[key]:{...(overrides[key]||{}),pixelPet:id}};setOverrides(next);setUser(u=>u?{...u,pixelPet:id}:u);write(STORAGE_KEYS.users,next);return null;
 };

const switchPortal=async(p:'ops'|'teacher'):Promise<string|null>=>{try{const res=await api.switchPortal(p);token.set(res.token);applyServer(await api.bootstrap<Bootstrap>());go('dashboard');return null}catch(e){return e instanceof ApiError&&e.message?e.message:'切换失败，请稍后重试'}};
return <Context.Provider value={{switchPortal,authenticated,setAuthenticated,enrollments,setEnrollments,role,setRole,programs,setPrograms,students,setStudents,teams,setTeams,teamLogs,setTeamLogs,courses,setCourses,feedbacks,setFeedbacks,files,setFiles,route,go,favorites,setFavorites,recent,setRecent,logs,log:(s)=>setLogs(v=>[s,...v]),assignments,setAssignments,articles,updateArticles,posts,updatePosts,createPost,postMetrics,trackPost,likedLocal,todos,addTodo,meKey,kpi,completeTodo,restoreTodo,deleteTodo,updateTodo,classTypes,setClassTypes,projects,setProjects,teachers,setTeachers,opsCourses,setOpsCourses,lessons,setLessons,lessonFeedbacks,setLessonFeedbacks,courseSessions,setCourseSessions,resourceFolders,setResourceFolders,announcements,unreadAnnouncements,createAnnouncement,markAnnouncementRead,markAllAnnouncementsRead,loadAnnouncementReads,loadAnnouncementDirectory,lessonMonthLocks,confirmLessonMonth,viewer,leader,removeRecord,staff,staffName,changePassword,updateAvatar,updateTheme,updateWeatherCity,updatePixelPet,admin,persisted,apiMode:API_ENABLED,user,restoring,login,logout,passwordDeferred,deferPasswordChange}}>{children}</Context.Provider>}
export const useNexus=()=>useContext(Context);
export function useVisible(){
  const s=useNexus();
  const salesName=s.user?.salesName||'';
  const myName=s.user?.name||'';
  // Pages / localStorage bootstrap: mirror API teacher scope from ops courses + team.teacher.
  const teacherScope=s.role==='teacher'?teacherRosterScope(myName,{
    opsCourses:s.opsCourses,courses:s.courses,teams:s.teams,enrollments:s.enrollments,students:s.students,
  }):null;
  const students=s.role==='sales'?s.students.filter(x=>salesOwns(x.sales,{name:myName,salesName}))
    :s.role==='teacher'?s.students.filter(x=>teacherScope!.studentIds.has(x.id))
    :s.students;
  const live=s.teams.filter(t=>!t.archived);
  const teams=s.role==='teacher'?live.filter(t=>teacherScope!.teamIds.has(t.id)):live;
  // 运营端 (ops / superadmin / admin): only courses where I am 授课老师 or 运营老师. 系统管理 reads s.opsCourses directly.
  const ownScope=s.role!=='sales'&&s.role!=='teacher'&&(myName||s.user?.email)?opsOwnScope({name:myName,email:s.user?.email||''},s.opsCourses,s.courses):null;
  const courses=s.courses.filter(c=>{
    if(ownScope)return ownScope.courseIds.has(c.id);
    if(s.role==='sales')return teams.some(t=>t.id===c.team)&&!!s.programs.find(p=>p.id===c.program)?.published;
    if(s.role==='teacher')return teacherScope!.courseIds.has(c.id)||teacherScope!.teamIds.has(c.team);
    return true;
  });
  const opsCourses=ownScope?ownScope.opsCourses:teacherScope?teacherScope.opsCourses:s.opsCourses;
  const courseIds=new Set(courses.map(c=>c.id));
  const courseSessions=dedupeSessions(s.courseSessions.filter(x=>courseIds.has(x.course)));
  return {
    students,teams,courses,opsCourses,courseSessions,
    files:s.files.filter(f=>s.role!=='sales'||f.public),
    feedbacks:s.feedbacks.filter(f=>{
      if(s.role==='sales')return f.visible&&students.some(x=>x.id===f.student);
      if(s.role==='teacher')return students.some(x=>x.id===f.student);
      return true;
    }),
  };
}
/** Display name of the signed-in user. */
export function useMe(){const s=useNexus();const name=s.user?.name||'';return {name,initial:name.slice(0,1)||'我',email:s.user?.email||''}}
