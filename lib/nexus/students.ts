/**
 * Student wellbeing status (学生状态) and homework records.
 * Kept free of runtime imports so tests/student-status.mjs can transpile it on its own.
 */
export type StudentHealth = '状态不佳' | '需关注' | '状态良好';
/** Ordered worst → best. Sales lists sort by this order so students needing help come first. */
export const healthLevels: readonly StudentHealth[] = ['状态不佳', '需关注', '状态良好'];
export const healthHints: Record<StudentHealth, string> = {
  状态不佳: '多项作业逾期或需返工，需尽快与家长、导师沟通',
  需关注: '个别任务滞后或质量波动，建议本周跟进',
  状态良好: '按时提交、反馈积极，保持当前节奏',
};
export type HealthRecord = { health: StudentHealth; healthNote: string; healthUpdated: string; healthBy: string };
export const isHealth = (value: unknown): value is StudentHealth => typeof value === 'string' && (healthLevels as readonly string[]).includes(value);
/** Unknown / unset statuses sort after every known level. */
export const healthRank = (value: unknown) => (isHealth(value) ? healthLevels.indexOf(value) : healthLevels.length);

export type AssignmentStatus = '逾期未交' | '需修改' | '待提交' | '已提交' | '已批改';
export type Assignment = {
  id: string; student: string; program: string; title: string; due: string;
  submitted: string | null; status: AssignmentStatus; score: number | null; feedback: string; teacher: string;
};
export const assignmentStatuses: readonly AssignmentStatus[] = ['逾期未交', '需修改', '待提交', '已提交', '已批改'];

export function assignmentSummary(list: readonly Assignment[]) {
  const count = (s: AssignmentStatus) => list.filter(a => a.status === s).length;
  const scored = list.filter(a => typeof a.score === 'number') as (Assignment & { score: number })[];
  const submitted = list.filter(a => a.submitted).length;
  const due = list.filter(a => a.status !== '待提交').length;
  return {
    total: list.length,
    submitted,
    reviewed: count('已批改'),
    overdue: count('逾期未交'),
    revise: count('需修改'),
    pending: count('待提交'),
    /** Share of assignments already due that have been handed in. */
    rate: due ? Math.round((list.filter(a => a.status !== '待提交' && a.submitted).length / due) * 100) : 100,
    average: scored.length ? Math.round(scored.reduce((n, a) => n + a.score, 0) / scored.length) : null,
  };
}

/**
 * Worst status first (状态不佳 → 需关注 → 状态良好). Within one level, more overdue
 * work first, then more work to redo; ties keep the original order (stable sort).
 */
export function sortByHealth<T extends { id: string; health?: unknown }>(students: readonly T[], assignments: readonly Assignment[] = []): T[] {
  const load = new Map<string, { overdue: number; revise: number }>();
  for (const a of assignments) {
    const v = load.get(a.student) ?? { overdue: 0, revise: 0 };
    if (a.status === '逾期未交') v.overdue++;
    if (a.status === '需修改') v.revise++;
    load.set(a.student, v);
  }
  return students
    .map((student, index) => ({ student, index }))
    .sort((a, b) => {
      const byRank = healthRank(a.student.health) - healthRank(b.student.health);
      if (byRank) return byRank;
      const la = load.get(a.student.id) ?? { overdue: 0, revise: 0 }, lb = load.get(b.student.id) ?? { overdue: 0, revise: 0 };
      return lb.overdue - la.overdue || lb.revise - la.revise || a.index - b.index;
    })
    .map(x => x.student);
}

const taskTitles: Record<string, string[]> = {
  bpa: ['商业案例拆解笔记', '目标市场调研表', '商业模式画布', '财务预测初稿', '模拟答辩讲稿'],
  ctb: ['研究问题陈述', '文献综述摘要', '访谈提纲', '调研数据整理', '研究报告第一稿'],
  conrad: ['创新选题说明', '用户痛点访谈记录', '原型草图', '技术可行性分析', '创新简报初稿'],
  prime: ['文献检索清单', '研究设计说明', '实验记录第一周', '数据分析小结', '论文引言初稿'],
  ihosa: ['健康议题调研', '受众画像', '传播内容脚本', '公益活动方案', '传播效果复盘'],
  mvp: ['用户访谈 5 人记录', '需求优先级矩阵', '产品原型链接', 'MVP 测试计划', '路演 BP 初稿'],
  winter: ['设计思维工作表', '作品草图', '材料清单', '原型制作记录', '展示海报'],
  summer: ['选题灵感卡', '团队分工表', '作品草图', '原型制作记录', '展示视频脚本'],
};
const praise = ['结构清晰，论据扎实，可作为小组范例。', '按时完成，细节到位，下一步可以挑战更高难度的拓展任务。', '思路完整，表达流畅，继续保持。'];
const okay = ['基本完成要求，但数据来源不足，请补充 2 条一手资料。', '框架可以，论证略单薄，建议对照评分标准再完善一次。', '完成度尚可，格式与引用需要统一。'];
const weak = ['内容缺失较多，核心部分尚未展开，请在本周内与导师约一次辅导。', '与任务要求偏差较大，请按批注重新整理后再提交。', '多处为模板原文，需要补充自己的分析。'];
const redo = ['请根据批注修改结论部分后重新提交。', '数据表与正文不一致，请核对后重交。'];
/** Per-health template: [status, score] for five tasks, oldest first. */
const patterns: Record<StudentHealth, [AssignmentStatus, number | null][]> = {
  状态不佳: [['已批改', 61], ['需修改', 55], ['逾期未交', null], ['逾期未交', null], ['待提交', null]],
  需关注: [['已批改', 82], ['已批改', 73], ['需修改', 68], ['已提交', null], ['待提交', null]],
  状态良好: [['已批改', 93], ['已批改', 88], ['已批改', 95], ['已提交', null], ['待提交', null]],
};
const dues = ['2026-09-20', '2026-09-27', '2026-10-04', '2026-10-09', '2026-10-18'];
const shift = (date: string, days: number) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

/** Deterministic demo homework for each student, shaped by their seeded status. */
export function seedAssignments(students: readonly { id: string; program: string; health?: unknown }[], teacherFor: (program: string) => string = () => '陈老师'): Assignment[] {
  return students.flatMap((s, si) => {
    const health = isHealth(s.health) ? s.health : '状态良好';
    const titles = taskTitles[s.program] ?? taskTitles.bpa;
    return patterns[health].map(([status, score], i) => {
      // Vary the sample a little between students without changing the level's character.
      const jitter = score === null ? null : Math.max(40, Math.min(99, score + ((si * 7 + i * 3) % 7) - 3));
      const submitted = status === '逾期未交' || status === '待提交' ? null : shift(dues[i], status === '需修改' && health === '状态不佳' ? 2 : -((si + i) % 3));
      const feedback = status === '已批改'
        ? (jitter! >= 85 ? praise : jitter! >= 70 ? okay : weak)[(si + i) % 3]
        : status === '需修改' ? redo[(si + i) % 2]
        : status === '逾期未交' ? '已超过截止时间，尚未收到提交。'
        : status === '已提交' ? '已收到，导师将在 48 小时内批改。' : '';
      return { id: `A-${s.id}-${i + 1}`, student: s.id, program: s.program, title: titles[i % titles.length], due: dues[i], submitted, status, score: status === '已批改' ? jitter : status === '需修改' ? jitter : null, feedback, teacher: teacherFor(s.program) };
    });
  });
}
