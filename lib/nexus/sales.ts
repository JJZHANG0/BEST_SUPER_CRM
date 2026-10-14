/**
 * 销售工作台 helpers (pure, no runtime imports so tests and the API can load them).
 * - Student ↔ 销售顾问 linkage: students.sales holds the adviser's display name from the 花名册
 *   (e.g. 「王明玉」, sometimes 「Sylvia 赵忠倩」 / 「Claire许瑾」), while users.sales_name is 「顾问 王明玉」.
 * - 名额: a team's capacity comes from its 课时课程's 班级类型 (「线上3-5人班型」 → 5, 「线下8人班型」 → 8).
 * - 项目单价: the 「项目参考价」 item of the published 项目书 price highlight; values marked 演示 / 待定 count as 0.
 */
export type SalesUser = { name?: string | null; salesName?: string | null };
const norm = (v: unknown) => String(v ?? '').normalize('NFKC').replace(/^顾问\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase();
/** True when a student's 负责销售 label belongs to this adviser (exact name, 「顾问 X」, or an English-prefixed label containing the Chinese name). */
export function salesOwns(studentSales: unknown, user: SalesUser): boolean {
  const s = norm(studentSales);
  if (!s) return false;
  const keys = [norm(user.name), norm(user.salesName)].filter(Boolean);
  return keys.some(k => s === k || (/[\u4e00-\u9fff]{2,}/.test(k) && s.includes(k)));
}

/** Max seats from a 班级类型 name: 「N人班」 → N, 「a-b人」 → b; open-ended (「N人及以上」) → null. */
export function capacityFromClassType(name: unknown): number | null {
  const n = String(name ?? '');
  if (/及以上|以上/.test(n)) return null;
  const range = /(\d+)\s*[-–~至]\s*(\d+)\s*人/.exec(n);
  if (range) return Number(range[2]);
  const fixed = /(\d+)\s*人班/.exec(n);
  return fixed ? Number(fixed[1]) : null;
}

export type PriceInfo = { fee: number; pending: boolean; label: string };
type Block = { type: string; kind?: string; items?: { label: string; value: string }[] };
/** 项目单价 from a published 项目书. Missing, 待定 or 演示 (placeholder) prices → { fee: 0, pending: true }. */
export function priceFromArticle(content: { blocks?: Block[] } | null | undefined): PriceInfo {
  const items = (content?.blocks || []).filter(b => b.type === 'highlight' && b.kind === 'price').flatMap(b => b.items || []);
  const item = items.find(i => /参考价|单价|价格|费用/.test(i.label) && /\d/.test(i.value)) || items.find(i => /参考价|单价/.test(i.label));
  if (!item) return { fee: 0, pending: true, label: '待定' };
  const raw = item.value || '';
  if (/待定|演示|示例|tbd/i.test(raw)) return { fee: 0, pending: true, label: '待定' };
  const m = /([\d][\d,，]*(?:\.\d+)?)\s*(万)?/.exec(raw);
  if (!m) return { fee: 0, pending: true, label: '待定' };
  const fee = Math.round(Number(m[1].replace(/[,，]/g, '')) * (m[2] ? 10000 : 1));
  return fee > 0 ? { fee, pending: false, label: '¥' + fee.toLocaleString('zh-CN') } : { fee: 0, pending: true, label: '待定' };
}

/** Project statuses that still take sign-ups. Anything else (已结束 / 已截止 / 已满员 / 关闭 / 筹备中 …) is treated as not recruiting. */
export const RECRUITING_STATUSES = ['招生中', '滚动招生', '预报名'];
/** Enrollment statuses that occupy a seat. */
export const inactiveEnrollment = (status: unknown) => ['已退出', '已结项', '待分配'].includes(String(status));
/** Pseudo teams from the 花名册 (退费 / 退班 buckets) are not cohorts. */
export const isPseudoTeam = (name: unknown) => /退费|退班/.test(String(name ?? ''));

export type TeamSeat = { id: string; program: string; name: string; teacher: string; enrolled: number; capacity: number | null; classType: string | null };
export type ProjectRecruitment = {
  program: string; enrolled: number; capacity: number; remaining: number; progress: number;
  teams: number; unknownTeams: number; recruiting: boolean; status: string;
};
/** Aggregate team seats per project. Teams without a known capacity count their members as both enrolled and capacity (no invented spare seats). */
export function projectRecruitment(programs: readonly { id: string; status: string }[], teams: readonly TeamSeat[], targets: readonly ProgramTarget[] = []): ProjectRecruitment[] {
  return programs.map(p => {
    const goal = targets.find(x => x.id === p.id);
    if (goal) {
      // Sheet project progress wins: remaining = 招生目标 − 已招生人数 (never negative); full when nothing remains.
      const n = teams.filter(t => t.program === p.id);
      const remaining = Math.max(0, goal.target - goal.enrolled);
      const open = RECRUITING_STATUSES.includes(p.status) || remaining > 0;
      return { program: p.id, enrolled: goal.enrolled, capacity: goal.target, remaining, progress: goal.target ? Math.min(100, Math.round(goal.enrolled / goal.target * 100)) : 0,
        teams: n.length, unknownTeams: n.filter(t => t.capacity == null).length, recruiting: remaining > 0 && open, status: remaining > 0 ? (RECRUITING_STATUSES.includes(p.status) ? p.status : '招生中') : '已满员' };
    }
    const list = teams.filter(t => t.program === p.id);
    const enrolled = list.reduce((n, t) => n + t.enrolled, 0);
    const capacity = list.reduce((n, t) => n + (t.capacity ?? t.enrolled), 0);
    const remaining = list.reduce((n, t) => n + (t.capacity != null ? Math.max(0, t.capacity - t.enrolled) : 0), 0);
    const unknownTeams = list.filter(t => t.capacity == null).length;
    const open = RECRUITING_STATUSES.includes(p.status);
    const full = list.length > 0 && unknownTeams === 0 && remaining === 0;
    const status = !open ? (p.status || '已结束') : full ? '已满员' : p.status;
    return { program: p.id, enrolled, capacity, remaining, progress: capacity ? Math.min(100, Math.round(enrolled / capacity * 100)) : 0, teams: list.length, unknownTeams, recruiting: open && !full, status };
  });
}
/** Recruiting first, by remaining seats (desc), then progress (asc) and name. */
export const sortRecruitment = (a: ProjectRecruitment, b: ProjectRecruitment) =>
  Number(b.recruiting) - Number(a.recruiting) || b.remaining - a.remaining || a.progress - b.progress || a.program.localeCompare(b.program);

export type SalesMember = { id: string; name: string; grade: string; status: string; health: string; school: string };
export type SalesTeam = TeamSeat & { members: SalesMember[]; hiddenMembers: number; recruitStatus?: string | null; posterUrl?: string | null; scheduleUrl?: string | null };
/** Project-level 招生目标 / 已招生人数 (项目总览 sheet). */
export type ProgramTarget = { id: string; target: number; enrolled: number };
/** Sheet 招募状态 → still recruiting? (火热招募 / 正常招募 yes; 招生结束 no). Unknown → null. */
export const sheetRecruiting = (s: unknown): boolean | null => s == null || s === '' ? null : /招生结束|结束|截止|满员/.test(String(s)) ? false : true;

/** 队伍招募状态 options in 队伍管理. Legacy sheet values (火热招募 / 正常招募 / 招生结束) are still understood. */
export const TEAM_RECRUIT_STATUSES = ['招募中', '火热招募', '已满', '已结束', '筹备中'] as const;
/** Normalise the sheet wording onto the 队伍管理 options. */
export const normalizeRecruitStatus = (s: unknown): string | null => {
  const v = String(s ?? '').trim();
  if (!v) return null;
  if (v === '正常招募') return '招募中';
  if (/招生结束|结束|截止/.test(v)) return '已结束';
  if (/满/.test(v)) return '已满';
  return v;
};
/** Enrolled = the larger of live active members and the recorded 已招人数 (sheet), so adding a member counts at once. */
export const teamEnrolled = (live: number, recorded: number | null | undefined) => Math.max(live, recorded ?? 0);
/** Remaining seats, live: capacity − enrolled (null when capacity unknown). */
export const teamRemaining = (capacity: number | null | undefined, enrolled: number) => capacity == null ? null : Math.max(0, capacity - enrolled);
/** A team is locked for sales (grey + lock, not clickable) when it is full or no longer recruiting. */
export function teamLocked(t: { capacity: number | null; enrolled: number; recruitStatus?: string | null }): boolean {
  const st = normalizeRecruitStatus(t.recruitStatus);
  if (st === '已满' || st === '已结束') return true;
  return t.capacity != null && t.capacity - t.enrolled <= 0;
}
/** 队伍 edit rights: superadmin always; otherwise the team's 负责人 (ops owner, matched by name or e-mail). Teams without an owner stay editable by any ops writer. */
export function canEditTeam(user: { role?: string | null; name?: string | null; email?: string | null } | null | undefined, team: { opsOwner?: string | null }): boolean {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  if (!(user.role === 'ops' || user.role === 'admin')) return false;
  const owner = norm(team.opsOwner);
  if (!owner) return true;
  return owner === norm(user.name) || owner === norm(user.email) || (/[\u4e00-\u9fff]{2,}/.test(norm(user.name)) && owner.includes(norm(user.name)));
}
