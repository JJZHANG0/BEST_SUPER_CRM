import type { Enrollment, Team } from './data';

export type ProgramOffer = {
  code: string; fee: number; feeNote: string; sessions: number; hours: number;
  audience: string; outcome: string; operations: string; teacherBio: string;
};
export type CohortOffer = { capacity: number; opens: string; deadline: string; schedule: string; admission: '招生中' | '已截止' | '筹备中'; };
const feeNote = '正式费用以签约报价为准。';
const pending = (code: string, audience: string, outcome: string): ProgramOffer => ({ code, fee: 0, feeNote, sessions: 0, hours: 0, audience, outcome, operations: '', teacherBio: '' });
/**
 * Per-programme admissions facts. Prices, lesson counts and contacts are left blank (0 / '') until
 * real figures are entered; the UI shows 待定 / 待指定 for blank values.
 */
export const programOffers: Record<string, ProgramOffer> = {
  bpa: pending('BPA', '高一至高三 · 对商业与管理感兴趣', '商业计划书、案例分析与模拟答辩'),
  ctb: pending('CTB', '高中生 · 具备研究兴趣', '研究报告、调研记录与项目展示'),
  conrad: pending('CONRAD', '高中生 · 关注科技与创新', '创新简报、产品原型与商业展示'),
  prime: pending('PT', '高中生 · 有明确学科探索方向', '科研报告、研究方法与成果展示'),
  ihosa: pending('IHOSA', '高中生 · 关注健康与公益议题', '公益传播策划与主题作品'),
  mvp: pending('MVP', '高中生 · 有创业或产品想法', '用户调研、最小可行产品与创业路演'),
  winter: pending('WINTER', '初三至高三 · 对动手创造感兴趣', '团队创客作品与成果展示'),
  summer: pending('SUMMER', '初三至高三 · 对创新实践感兴趣', '创客作品与夏令营项目展示'),
};
const blankOffer = pending('', '', '');
export const offerFor = (program: string) => programOffers[program] ?? blankOffer;
/** Cohort capacity / dates by team id. Empty until real cohorts are configured. */
export const cohortOffers: Record<string, CohortOffer> = {};
export function cohortAvailability(team: Team, enrollments: Enrollment[], offer: CohortOffer | undefined = cohortOffers[team.id]) {
  const confirmed=new Set(enrollments.filter(e=>e.team===team.id&&!['已退出','已结项','待分配'].includes(e.status)).map(e=>e.student)).size;
  const capacity=offer?.capacity??confirmed;
  const remaining=Math.max(0,capacity-confirmed);
  // No cohort configured yet: not open for admissions (no invented capacity).
  const status=!offer||offer.admission==='筹备中'?'筹备中':offer?.admission==='已截止'?'已截止':remaining===0?'已满员':'招生中';
  return {confirmed,capacity,remaining,status,progress:capacity?Math.min(100,Math.round(confirmed/capacity*100)):0};
}
export const money=(amount:number)=>'¥'+amount.toLocaleString('zh-CN');
export const priceText=(fee:number)=>fee>0?money(fee):'待定';
export const planText=(o:{sessions:number;hours:number})=>o.sessions>0?`${o.sessions} 次 · ${o.hours} 课时`:'待定';
