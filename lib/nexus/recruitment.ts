import type { Enrollment, Team } from './data';

export type ProgramOffer = {
  code: string; fee: number; feeNote: string; sessions: number; hours: number;
  audience: string; outcome: string; operations: string; teacherBio: string;
};
export type CohortOffer = { capacity: number; opens: string; deadline: string; schedule: string; admission: '招生中' | '已截止' | '筹备中'; };
const feeNote = '演示价格／人；包含项目指导，不含赛事报名、差旅与住宿。正式费用以签约报价为准。';
export const programOffers: Record<string, ProgramOffer> = {
  bpa: {code:'NX-26-BPA',fee:12800,feeNote,sessions:12,hours:18,audience:'高一至高三 · 对商业与管理感兴趣',outcome:'商业计划书、案例分析与模拟答辩',operations:'示例·陈运营',teacherBio:'示例导师，负责商业案例、市场分析与表达训练。'},
  ctb: {code:'NX-26-CTB',fee:15800,feeNote,sessions:16,hours:24,audience:'高中生 · 具备研究兴趣',outcome:'研究报告、调研记录与项目展示',operations:'示例·林运营',teacherBio:'示例导师，负责研究设计、社会调研与学术表达。'},
  conrad: {code:'NX-26-CON',fee:19800,feeNote,sessions:20,hours:30,audience:'高中生 · 关注科技与创新',outcome:'创新简报、产品原型与商业展示',operations:'示例·周运营',teacherBio:'示例导师，负责创新设计、原型验证与项目路演。'},
  prime: {code:'NX-26-PT',fee:26800,feeNote,sessions:16,hours:24,audience:'高中生 · 有明确学科探索方向',outcome:'科研报告、研究方法与成果展示',operations:'示例·陈运营',teacherBio:'示例导师，负责文献阅读、研究方法与成果指导。'},
  ihosa: {code:'NX-26-HOSA',fee:9800,feeNote,sessions:10,hours:15,audience:'高中生 · 关注健康与公益议题',outcome:'公益传播策划与主题作品',operations:'示例·林运营',teacherBio:'示例导师，负责健康议题研究与公益传播策划。'},
  mvp: {code:'NX-26-MVP',fee:16800,feeNote,sessions:14,hours:21,audience:'高中生 · 有创业或产品想法',outcome:'用户调研、最小可行产品与创业路演',operations:'示例·周运营',teacherBio:'示例导师，负责需求分析、产品设计与创业验证。'},
  winter: {code:'NX-27-WIN',fee:6800,feeNote,sessions:8,hours:24,audience:'初三至高三 · 对动手创造感兴趣',outcome:'团队创客作品与成果展示',operations:'示例·陈运营',teacherBio:'示例导师，负责设计思维与创客实践。'},
  summer: {code:'NX-27-SUM',fee:7800,feeNote,sessions:10,hours:30,audience:'初三至高三 · 对创新实践感兴趣',outcome:'创客作品与夏令营项目展示',operations:'示例·林运营',teacherBio:'示例导师，负责跨学科创作与团队协作。'},
};
export const cohortOffers: Record<string, CohortOffer> = Object.fromEntries(
  Array.from({length:14},(_,i)=>[`T${String(i+1).padStart(3,'0')}`,{
    capacity:[4,6,6,5,8,6,6,5,4,6,8,6,12,16][i],
    opens:i===12?'2027-01-20':i===13?'2027-07-10':`2026-10-${String(18+i%7).padStart(2,'0')}`,
    deadline:i===12?'2027-01-10':i===13?'待发布':'2026-10-15',
    schedule:i>=12?'营地集中授课 · 每日安排开营前发布':i%2?'每周日 16:00–17:30（北京时间）':'每周六 14:00–15:30（北京时间）',
    admission:i===13?'筹备中':i===8?'已截止':'招生中',
  }])
);
export function cohortAvailability(team: Team, enrollments: Enrollment[]) {
  const offer=cohortOffers[team.id];
  const confirmed=new Set(enrollments.filter(e=>e.team===team.id&&!['已退出','已结项','待分配'].includes(e.status)).map(e=>e.student)).size;
  const capacity=offer?.capacity??confirmed;
  const remaining=Math.max(0,capacity-confirmed);
  const status=offer?.admission==='筹备中'?'筹备中':offer?.admission==='已截止'?'已截止':remaining===0?'已满员':'招生中';
  return {confirmed,capacity,remaining,status,progress:capacity?Math.min(100,Math.round(confirmed/capacity*100)):0};
}
export const money=(amount:number)=>'¥'+amount.toLocaleString('zh-CN');
