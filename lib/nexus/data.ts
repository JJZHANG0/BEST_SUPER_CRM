export type Role = 'ops' | 'sales' | 'admin';
export type Program = {id:string;name:string;en:string;short:string;type:string;color:string;description:string;date:string;status:string;curriculum:string;draft?:string;published:boolean};
import type { StudentHealth } from './students';
export type Student = {id:string;name:string;program:string;team:string;status:string;sales:string;updated:string;grade:string;
  /** 学生状态 — set by ops, drives the sales list order (worst first). */
  health:StudentHealth;healthNote:string;healthUpdated:string;healthBy:string};
export type Enrollment = {id:string;student:string;program:string;team:string;status:string};
export type Team = {id:string;name:string;program:string;teacher:string;stage:number;status:string;note:string};
export type Course = {id:string;name:string;program:string;team:string;teacher:string;date:string;time:string;status:string};
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
const teamNames=['星际探索者','未蓝计划','零碳实验室','未来引力','光合小组','边界之外','创想引擎','新知研究所','无限可能','向光而行','青禾实验室','破晓计划'];
export const teams:Team[]=teamNames.map((name,i)=>({id:`T${String(i+1).padStart(3,'0')}`,name,program:programs[i%6].id,teacher:['陈老师','林老师','周老师'][i%3],stage:[2,1,3,1,2,2,3,1,4,2,1,3][i],status:i===0?'材料待补充':i===2?'反馈待处理':i===4?'进度延期':'正常进行',note:i===0?'商业计划书缺少财务预测部分，请于 10 月 12 日前补齐。':i===2?'请确认本周课程反馈并与指导老师沟通。':i===4?'中期成果待提交，需要协调下一次指导时间。':''}));
const healthNotes:Record<StudentHealth,string[]>={
  状态不佳:['连续两次作业逾期，课堂参与度下降，已约家长本周沟通。','近期缺课一次，作业需返工，建议顾问协助跟进学习计划。'],
  需关注:['最近一次作业需返工，注意时间管理。','课堂表现积极，但书面材料质量波动，请提醒按评分标准自查。'],
  状态良好:['按时提交，课堂表现积极。','作业质量稳定，可尝试拓展任务。'],
};
function seedHealth(i:number){const health:StudentHealth=[4,10,13,19,27,31,40].includes(i)?'状态不佳':(i%4===1||i%7===3)?'需关注':'状态良好';return {health,healthNote:healthNotes[health][i%2],healthUpdated:`10-${String(8+i%3).padStart(2,'0')} 1${i%10}:20`,healthBy:['陈老师','林老师','周老师'][i%3]}}
const names=['林知夏','陈星野','许言溪','周予安','沈沐白','苏念初','顾思远','江以宁','陆景然','叶书禾','宋清和','林可颂'];
export const students:Student[]=Array.from({length:48},(_,i)=>({id:`DEMO-${String(i+1).padStart(4,'0')}`,name:`示例·${names[i%12]}${i>=12?Math.floor(i/12)+1:''}`,program:teams[i%12].program,team:teams[i%12].id,status:i%9===0?'待开课':i%13===0?'已结项':'进行中',sales:i%3===0?'顾问 B':'顾问 Alex',updated:'10-09 09:30',grade:['高一','高二','高三'][i%3],...seedHealth(i)}));
export const courses:Course[]=Array.from({length:18},(_,i)=>({id:`C${i+1}`,name:['商业策略与案例分析','研究方法与选题讨论','创新方案中期指导','科研文献阅读','公益传播内容策划','产品用户需求访谈'][i%6],program:teams[i%12].program,team:teams[i%12].id,teacher:teams[i%12].teacher,date:`2026-10-${String(9+Math.floor(i/3)).padStart(2,'0')}`,time:['14:00–15:30','16:00–17:30','19:00–20:30'][i%3],status:'已安排'}));
export const feedbacks:Feedback[]=[{id:'F1',student:'DEMO-0002',course:'C2',content:'完成了研究问题的初步定义，主动参与小组讨论。建议进一步缩小调研范围，并补充一手资料。',next:'完成访谈提纲，安排 3 位受访者。',visible:true,date:'2026-10-08'},{id:'F2',student:'DEMO-0001',course:'C1',content:'已完成商业模式画布的初稿，财务预测部分需要补充。',next:'提交修订后的商业计划书。',visible:true,date:'2026-10-08'}];
export const resources:Resource[]=[{id:'R1',program:'bpa',name:'BPA 项目招生手册',type:'招生资料',format:'PDF',size:'演示文件',public:true},{id:'R2',program:'conrad',name:'康莱德项目介绍',type:'项目介绍',format:'PDF',size:'演示文件',public:true},{id:'R3',program:'ctb',name:'CTB 研究计划模板',type:'学生模板',format:'PDF',size:'演示文件',public:true},{id:'R4',program:'bpa',name:'BPA 宣传海报',type:'宣传图片',format:'SVG',size:'演示图片',public:true},{id:'R5',program:'prime',name:'科研导师教学指引',type:'内部运营',format:'PDF',size:'演示文件',public:false},{id:'R6',program:'ihosa',name:'公益传媒项目手册',type:'招生资料',format:'PDF',size:'演示文件',public:true},
  // Posters double as shareable resources so every project has material in 资料中心.
  ...([['ctb','CTB'],['conrad','康莱德'],['prime','PrimeTeach'],['ihosa','iHOSA-BCE'],['mvp','MVP'],['winter','寒假创客营地'],['summer','暑假创客营地']] as const).map(([program,label],i)=>({id:`R${7+i}`,program,name:`${label} 招生海报`,type:'宣传图片',format:'SVG',size:'演示图片',public:program!=='summer',file:`poster-${program}.svg`}))];
export type Resource = {id:string;program:string;name:string;type:string;format:string;size:string;public:boolean;/** File name under public/materials when it differs from `${id}.pdf|svg`. */file?:string};
export const announcements=[{title:'BPA 新赛季招生资料已更新',tag:'资料更新',date:'今天 09:20',text:'项目介绍与招生手册已发布，可在项目中心查看。',program:'bpa'},{title:'康莱德项目中期材料提交提醒',tag:'重要提醒',date:'昨天 16:45',text:'请各队伍于 10 月 15 日前完成中期成果整理。',program:'conrad'},{title:'CTB 本周课程安排已发布',tag:'课程通知',date:'昨天 14:30',text:'请提前查看研究方法课程的课前准备。',program:'ctb'}];

export const enrollments:Enrollment[]=[...students.map(x=>({id:'E-'+x.id,student:x.id,program:x.program,team:x.team,status:x.status})),{id:'E-DEMO-0002-extra',student:'DEMO-0002',program:'bpa',team:'T007',status:'已结项'}];

teams.push({id:'T013',name:'寒假创客第一期',program:'winter',teacher:'陈老师',stage:1,status:'正常进行',note:''},{id:'T014',name:'暑假创客预备队',program:'summer',teacher:'林老师',stage:1,status:'正常进行',note:''});
