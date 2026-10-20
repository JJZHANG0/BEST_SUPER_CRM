/**
 * 花名册 (roster) field labels for 学生档案 · 基本档案.
 * Union schema across Excel imports (docs/roster-import-report.json / scripts/roster-report.json).
 * Missing keys stay empty / omitted; UI surfaces every present column; user will later prune.
 */
import type { StudentProfile } from './data';

/** Ordered known roster columns (camelCase keys stored in students.profile). */
export const PROFILE_FIELDS: { key: keyof StudentProfile; label: string }[] = [
  { key: 'gender', label: '性别' },
  { key: 'school', label: '就读学校' },
  { key: 'phone', label: '学生电话' },
  { key: 'email', label: '学生邮箱' },
  { key: 'idType', label: '身份证明文件' },
  { key: 'idNumber', label: '身份证明号码' },
  { key: 'guardianName', label: '监护人姓名' },
  { key: 'guardianPhone', label: '监护人电话' },
  { key: 'toeflIelts', label: 'TOEFL / IELTS' },
  { key: 'mbti', label: 'MBTI' },
  { key: 'awardsA', label: '竞赛获奖 A' },
  { key: 'awardsB', label: '竞赛获奖 B' },
  { key: 'role', label: '队伍角色 / 岗位' },
  { key: 'inviter', label: '邀请老师' },
  { key: 'bdTeacher', label: '对应 BD 老师' },
  { key: 'opsTeacher', label: '项目运营老师' },
  { key: 'region', label: '销售大区' },
  { key: 'payment', label: '缴费状态 / 金额' },
  { key: 'filler', label: '填写人' },
  { key: 'filledAt', label: '填写时间' },
  { key: 'userType', label: '用户类型' },
  { key: 'department', label: '所在部门' },
  { key: 'intention1', label: '第一意向' },
  { key: 'intention2', label: '第二意向' },
  { key: 'schedulePref', label: '时间段偏好' },
  { key: 'knowsContest', label: '是否了解比赛' },
  { key: 'goal', label: '期望收获' },
  { key: 'resume', label: '简历' },
  { key: 'wantCaptain', label: '是否想成为队长' },
  { key: 'commit', label: '参赛承诺' },
  { key: 'offlineOk', label: '可线下决赛' },
  { key: 'interview', label: '面试记录' },
  { key: 'bpaPassword', label: 'BPA 密码' },
  { key: 'paymentScreenshot', label: '缴费截图' },
  { key: 'source', label: '花名册来源' },
  { key: 'nameEn', label: '证件英文拼音' },
  { key: 'birthDate', label: '出生日期' },
  { key: 'address', label: '居住地址（英文）' },
  { key: 'schoolEn', label: '学校英文全称' },
  { key: 'schoolAddress', label: '学校地址及邮编' },
  { key: 'schoolType', label: '学校性质' },
  { key: 'guardianEmail', label: '监护人邮箱' },
  { key: 'signupPrograms', label: '报名项目（表单）' },
  { key: 'languageTest', label: '语言考试类型' },
  { key: 'languageTotal', label: '语言总分' },
  { key: 'languageSpeaking', label: '口语分数' },
  { key: 'pastCompetitions', label: '过往竞赛经历' },
  { key: 'formNote', label: '报名补充说明' },
  { key: 'formExtras', label: '表单补充信息' },
  { key: 'formSubmission', label: '收集表单记录号' },
];

const LABEL_BY_KEY = Object.fromEntries(PROFILE_FIELDS.map(f => [f.key, f.label])) as Record<string, string>;

/** Build Info rows: core identity + every roster column present (known labels first, then extras). */
export function profileInfoItems(
  student: { name: string; sales: string; grade: string; id: string; profile?: StudentProfile | Record<string, string> | null },
): [string, string][] {
  const core: [string, string][] = [
    ['学生姓名', student.name],
    ['学号 / 档案编号', student.id],
    ['负责销售', student.sales || '—'],
    ['年级', student.grade || '—'],
    ['档案状态', '有效'],
  ];
  const profile = (student.profile || {}) as Record<string, string>;
  const seen = new Set<string>();
  const rows: [string, string][] = [];
  for (const { key, label } of PROFILE_FIELDS) {
    const v = profile[key];
    if (v == null || String(v).trim() === '') continue;
    seen.add(key);
    rows.push([label, String(v)]);
  }
  // Any leftover keys from a future import — still surface them.
  for (const [k, v] of Object.entries(profile)) {
    if (seen.has(k) || v == null || String(v).trim() === '') continue;
    rows.push([LABEL_BY_KEY[k] || k, String(v)]);
  }
  return [...core, ...rows];
}
