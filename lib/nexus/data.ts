export type { Role } from './roles';
export type Program = {id:string;name:string;en:string;short:string;type:string;color:string;description:string;date:string;status:string;curriculum:string;draft?:string;published:boolean;
  /** Manual 招募 flag: 已满员 / 停止招生 (hides the project from sales 火热招募) */ recruitFlag?:string|null};
import type { StudentHealth } from './students';
/** Optional roster fields (union across Excel imports — docs/roster-import-report.json). Missing keys stay empty / omitted. */
export type StudentProfile = {
  gender?:string; school?:string; phone?:string; email?:string;
  guardianName?:string; guardianPhone?:string; role?:string;
  idType?:string; idNumber?:string; toeflIelts?:string; mbti?:string;
  awardsA?:string; awardsB?:string; inviter?:string; region?:string;
  filledAt?:string; source?:string;
  bdTeacher?:string; opsTeacher?:string; payment?:string; filler?:string;
  userType?:string; department?:string; intention1?:string; intention2?:string;
  schedulePref?:string; knowsContest?:string; goal?:string; resume?:string;
  wantCaptain?:string; commit?:string; offlineOk?:string; interview?:string;
  bpaPassword?:string; paymentScreenshot?:string;
};
export type Student = {id:string;name:string;program:string;team:string;status:string;sales:string;updated:string;grade:string;
  /** 学生状态 — set by ops, drives the sales list order (worst first). */
  health:StudentHealth;healthNote:string;healthUpdated:string;healthBy:string;
  /** Extra fields from 花名册 import (union schema). */
  profile?:StudentProfile};
export type Enrollment = {id:string;student:string;program:string;team:string;status:string};
export type TeamProgress = {summary:string;milestones:string;risks:string;updated?:string;updatedBy?:string};
export type TeamMaterials = {checklist:string;links:string;notes:string;updated?:string;updatedBy?:string};
export type TeamLog = {id:string;team:string;at:string;by:string;byName:string;action:string;detail:string};
export type Team = {id:string;name:string;program:string;teacher:string;stage:number;status:string;note:string;
  /** 队伍进度 — PM 定义字段，队伍老师/运营老师后续填写 */ progress?:TeamProgress;
  /** 成果材料 */ materials?:TeamMaterials;
  /** 运营负责人 (name) — may edit 名额 / 招募状态 / 海报 / 成员 */ opsOwner?:string;
  /** 招募状态: 招募中 / 火热招募 / 已满 / 已结束 / 筹备中 */ recruitStatus?:string|null;
  /** 名额 (capacity) */ recruitCapacity?:number|null;
  /** 已招人数 recorded (e.g. from the 项目总览 sheet); live members count if larger */ recruitEnrolled?:number|null;
  posterUrl?:string|null;scheduleUrl?:string|null;
  /** Soft-deleted (has courses / students) */ archived?:boolean|null};

/** A course (课程安排). date/time are its first meeting; repeated meetings live in course_sessions (lib/nexus/schedule.ts). */
export type Course = {id:string;name:string;program:string;team:string;teacher:string;date:string;time:string;status:string;
  /** 课程编号 (optional; e.g. the 课时记录 course code) and 教室 / 线上 shown on the timetable. */ code?:string;location?:string;
  /** Saved with 「强制设定」 despite 排课冲突. */ conflictOverride?:boolean};
export type Feedback = {id:string;student:string;course:string;content:string;next:string;visible:boolean;date:string};
export const stages=['项目启动','研究与开发','中期审核','成果完善','最终提交'];
export const programs:Program[]=[
{id:'bpa',name:'BPA 美国商业全能挑战赛',en:'Business Professionals of America',short:'BPA',type:'商业竞赛',color:'violet',description:'从商业洞察到实践表达，培养面向未来的商业领导力。',date:'2026-10-20',status:'招生中',curriculum:'商业基础与案例分析\n市场调研与商业策略\n商业计划书撰写\n展示表达与模拟答辩',published:true},
{id:'ctb',name:'CTB 全球青年创新论坛',en:'China Thinks Big',short:'CTB',type:'创新研究',color:'blue',description:'以真实问题为起点，用跨学科研究回应社会挑战。',date:'2026-10-18',status:'招生中',curriculum:'研究问题定义\n研究方法与调研\n成果呈现与讨论',published:true},
{id:'conrad',name:'康莱德创新挑战赛',en:'Conrad Challenge',short:'CONRAD',type:'科技创新',color:'pink',description:'让大胆的想法成为解决真实问题的创新方案。',date:'2026-10-15',status:'招生中',curriculum:'创新选题\n原型设计\n商业验证\n创新简报与路演',published:true},
{id:'prime',name:'PrimeTeach 定制科研课题',en:'Personalized Research Program',short:'PT',type:'学术科研',color:'green',description:'与导师深度探索学科前沿，建立严谨的科研思维。',date:'2026-10-22',status:'滚动招生',curriculum:'文献检索\n研究设计\n实验与分析\n论文写作',published:true},
{id:'ihosa',name:'iHOSA-BCE 公益传媒研习',en:'Health & Social Impact',short:'iHOSA',type:'公益传媒',color:'orange',description:'连接健康议题与公益传播，让青年的声音被听见。',date:'2026-10-25',status:'招生中',curriculum:'议题研究\n内容策划\n公益传播实践',published:true},
{id:'mvp',name:'MVP 创业孵化',en:'Minimum Viable Product',short:'MVP',type:'创业实践',color:'violet',description:'从用户需求出发，验证你的第一个创业想法。',date:'2026-11-01',status:'招生中',curriculum:'用户访谈\n产品设计\n最小可行产品\n创业路演',published:true},
{id:'winter',name:'寒假创客马拉松营地',en:'Winter Maker Camp',short:'WINTER',type:'创客营地',color:'blue',description:'在密集协作中学习创造，把灵感变为可展示的作品。',date:'2027-01-20',status:'预报名',curriculum:'设计思维\n动手制作\n作品展示',published:true},
{id:'summer',name:'暑假创客马拉松营地',en:'Summer Maker Camp',short:'SUMMER',type:'创客营地',color:'orange',description:'一场跨越学科的夏日创作旅程，与伙伴共同探索可能。',date:'2027-07-10',status:'筹备中',curriculum:'课程安排待发布',published:false},
];

/**
 * Real data starts empty: teams, students, enrollments, schedule, feedback, files and announcements
 * are created in the app (or loaded from the API). Programmes above are the catalogue / reference data.
 */
export const teams:Team[]=[];
export const students:Student[]=[];
export const courses:Course[]=[];
export const feedbacks:Feedback[]=[];
export type Resource = {id:string;program:string;name:string;type:string;format:string;size:string;public:boolean;/** File name under public/materials when it differs from `${id}.pdf|svg`. */file?:string;/** 资料中心 folder id (resource_folders). */folder?:string};
export type ResourceFolder = {id:string;program:string;name:string};
export const resources:Resource[]=[];
/** @deprecated static seed — live announcements come from the store / API (lib/nexus/announcements.ts). */
export type Announcement = {title:string;tag:string;date:string;text:string;program:string};
export const announcements:Announcement[]=[];

export const enrollments:Enrollment[]=[];
