/**
 * 收集表单 (student self-registration): shared types, the seeded 「各项竞赛报名学员信息收集表」,
 * answer validation (browser + server), and the 队伍绑定分发 mapping onto the student profile.
 * Pure module: no React, no DB — used by server/forms.ts, the public page and the admin page.
 */
export const QUESTION_TYPES = ['section', 'text', 'textarea', 'single', 'multi', 'select', 'date', 'phone', 'email', 'number'] as const;
export type QuestionType = typeof QUESTION_TYPES[number];
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  section: '分组标题', text: '单行文本', textarea: '多行文本', single: '单选', multi: '多选', select: '下拉选择', date: '日期', phone: '手机号', email: '邮箱', number: '数字',
};
export const isQuestionType = (v: unknown): v is QuestionType => typeof v === 'string' && (QUESTION_TYPES as readonly string[]).includes(v);
export const hasOptions = (t: QuestionType) => t === 'single' || t === 'multi' || t === 'select';

export type FormOption = { value: string; zh: string; en: string; other?: boolean };
export type FormQuestion = {
  id: string; type: QuestionType; labelZh: string; labelEn: string; helpZh: string; helpEn: string; placeholder: string;
  required: boolean; options: FormOption[]; requireAll: boolean; mapTo: string;
};
export type FormDef = { id: string; slug: string; title: string; titleEn: string; intro: string; introEn: string; open: boolean; version: number; questions: FormQuestion[] };
export type AnswerValue = string | string[];
export type AnswerSnapshot = { id: string; type: string; labelZh: string; labelEn: string; mapTo: string; value: AnswerValue };
export const SUBMISSION_STATUSES = ['待分配', '已分配', '已忽略'] as const;
export type SubmissionStatus = typeof SUBMISSION_STATUSES[number];
export const isSubmissionStatus = (v: unknown): v is SubmissionStatus => typeof v === 'string' && (SUBMISSION_STATUSES as readonly string[]).includes(v);
export type Submission = {
  id: string; formId: string; formVersion: number; answers: AnswerSnapshot[]; name: string; phone: string; status: SubmissionStatus;
  program: string | null; team: string | null; studentId: string | null; assignedBy: string | null; assignedAt: string | null; note: string; createdAt: string;
};

/** Separator stored for an "其他" option with free text: 其他：xxx */
export const OTHER_SEP = '：';

/**
 * Student-profile targets for 队伍绑定分发. `name` / `grade` go to the student record itself; every other key lands in
 * students.profile (the 学生档案 · 基本档案 card shows them). Questions without a target are kept as 表单补充信息.
 */
export const PROFILE_TARGETS: { key: string; label: string }[] = [
  { key: 'name', label: '学生姓名（中文 + 拼音）' },
  { key: 'grade', label: '年级' },
  { key: 'signupPrograms', label: '报名项目' },
  { key: 'gender', label: '性别' },
  { key: 'birthDate', label: '出生日期' },
  { key: 'idType', label: '身份证明文件' },
  { key: 'idNumber', label: '身份证明号码' },
  { key: 'phone', label: '学生电话' },
  { key: 'email', label: '学生邮箱' },
  { key: 'address', label: '居住地址（英文）' },
  { key: 'school', label: '就读学校' },
  { key: 'schoolEn', label: '学校英文全称' },
  { key: 'schoolAddress', label: '学校地址及邮编' },
  { key: 'schoolType', label: '学校性质' },
  { key: 'guardianName', label: '监护人姓名' },
  { key: 'guardianPhone', label: '监护人电话' },
  { key: 'guardianEmail', label: '监护人邮箱' },
  { key: 'languageTest', label: '语言考试类型' },
  { key: 'languageTotal', label: '语言总分' },
  { key: 'languageSpeaking', label: '口语分数' },
  { key: 'mbti', label: 'MBTI' },
  { key: 'pastCompetitions', label: '过往竞赛经历' },
  { key: 'awardsA', label: '竞赛获奖 A' },
  { key: 'formNote', label: '报名补充说明' },
];
const TARGET_KEYS = new Set(PROFILE_TARGETS.map(t => t.key));
export const isProfileTarget = (v: unknown) => v === '' || (typeof v === 'string' && TARGET_KEYS.has(v));

const o = (value: string, zh: string, en: string, other = false): FormOption => other ? { value, zh, en, other } : { value, zh, en };
const q = (id: string, type: QuestionType, labelZh: string, labelEn: string, extra: Partial<FormQuestion> = {}): FormQuestion =>
  ({ id, type, labelZh, labelEn, helpZh: '', helpEn: '', placeholder: '', required: false, options: [], requireAll: false, mapTo: '', ...extra });

/** 「报名学员竞赛信息收集表」 (originally 「各项竞赛报名学员信息收集表」 (/workspace/uploads/student_form.docx), questions 01–22 + 填写前请核对. */
export const DEFAULT_FORM: Omit<FormDef, 'id' | 'slug' | 'version' | 'open'> = {
  title: '报名学员竞赛信息收集表',
  titleEn: 'STUDENT COMPETITION INFORMATION FORM',
  intro: '用于学生报名资料整理与竞赛注册信息填写。请按证件及学校官方信息准确填写。带 * 为必填；“其他个人信息”为选填。所收集信息仅用于学生所选竞赛的中国站/全球站报名、注册、赛事通知及证书信息核对。请勿填写与报名无关的隐私信息。',
  introEn: 'Please fill in exactly as shown on your ID documents and official school records. Fields marked * are required. Information is used only for registration, notices and certificate checks for the competitions you select.',
  questions: [
    q('s1', 'section', '竞赛报名信息', 'COMPETITION REGISTRATION', { helpZh: '请根据本次报名项目选择；可多选。', helpEn: 'Select the program(s) you are registering for. Multiple choices allowed.' }),
    q('q01', 'multi', '报名项目', 'PROGRAMS', { required: true, mapTo: 'signupPrograms', options: [
      o('康莱德挑战赛', '康莱德挑战赛', 'Conrad Challenge'), o('CBPA', 'CBPA', 'CBPA'), o('CTB', 'CTB', 'CTB'), o('iHOSA', 'iHOSA', 'iHOSA'),
      o('钻石挑战赛', '钻石挑战赛', 'Diamond Challenge'), o('蓝海', '蓝海', 'Blue Ocean'), o('MVP定制', 'MVP定制', 'MVP Custom'), o('其他', '其他', 'Other', true)] }),
    q('s2', 'section', '学生基本信息', 'STUDENT INFORMATION', { helpZh: '姓名、证件和出生日期请与报名证件保持一致。请谨慎填写，后续报名直接提交该表单信息。', helpEn: 'Name, ID and date of birth must match your ID document. This information is submitted directly for registration.' }),
    q('q02', 'text', '中文姓名及证件上英文拼音', 'CHINESE NAME & PINYIN AS ON ID', { required: true, mapTo: 'name', placeholder: '例：程雪晴 CHENG XUEQING' }),
    q('q03', 'single', '性别', 'GENDER', { required: true, mapTo: 'gender', options: [o('女', '女', 'Female'), o('男', '男', 'Male')] }),
    q('q04', 'date', '出生日期', 'DATE OF BIRTH', { required: true, mapTo: 'birthDate', helpZh: '年 / 月 / 日', helpEn: 'YYYY / MM / DD' }),
    q('q05', 'single', '身份证明文件类型', 'ID DOCUMENT TYPE', { required: true, mapTo: 'idType', options: [
      o('居民身份证', '居民身份证', 'Resident ID Card'), o('护照', '护照', 'Passport'), o('港澳居民来往内地通行证', '港澳居民来往内地通行证', 'MAINLAND TRAVEL PERMIT FOR HONG KONG AND MACAO RESIDENTS'),
      o('台湾居民来往大陆通行证', '台湾居民来往大陆通行证', 'Taiwan Compatriot Permit'), o('其他', '其他', 'Other', true)] }),
    q('q06', 'text', '证件号码', 'ID NUMBER', { required: true, mapTo: 'idNumber', helpZh: '请仔细核对号码及有效期；按报名要求提供。', helpEn: 'Double-check the number and expiry date.' }),
    q('q07', 'phone', '学生手机号', 'STUDENT MOBILE', { required: true, mapTo: 'phone', helpZh: '大陆手机号可直接填写；如非大陆号码请注明国家/地区代码。', helpEn: 'Mainland numbers as is; otherwise include the country/region code, e.g. +852.' }),
    q('q08', 'email', '常用邮箱', 'EMAIL', { required: true, mapTo: 'email', helpZh: '用于接收赛事重要信息、注册通知及证书。', helpEn: 'Used for key competition notices, registration and certificates.' }),
    q('q09', 'textarea', '居住地址（英文）', 'HOME ADDRESS (IN ENGLISH)', { required: true, mapTo: 'address', helpZh: '需包含街道、城市、省/州、国家及邮编。', helpEn: 'Street, city, province/state, country and postal code.' }),
    q('s3', 'section', '在读学校信息', 'SCHOOL INFORMATION', { helpZh: '请填写学校官方全称；若就读国际部，请同时注明学校和国际部名称。', helpEn: 'Use the official full name; for an international department, give both the school and department.' }),
    q('q10', 'text', '学校中文全称', 'SCHOOL NAME (CHINESE)', { required: true, mapTo: 'school', placeholder: '例：华南师范大学附属中学国际部' }),
    q('q11', 'text', '学校英文全称', 'SCHOOL NAME (ENGLISH)', { required: true, mapTo: 'schoolEn', placeholder: 'e.g. International Department, The Affiliated High School of South China Normal University' }),
    q('q12', 'textarea', '学校地址及邮编（英文）', 'SCHOOL ADDRESS & POSTAL CODE (IN ENGLISH)', { required: true, mapTo: 'schoolAddress', helpZh: '需包含街道、区/县、城市、省/州、国家及邮编。', helpEn: 'Street, district, city, province/state, country and postal code.', placeholder: 'e.g. Aoxiang Building, Huafu, No. 1 Zhongshan Avenue West, Tianhe District, Guangzhou, Guangdong, China, 510630' }),
    q('q13', 'single', '学校性质', 'SCHOOL TYPE', { required: true, mapTo: 'schoolType', options: [o('公立', '公立', 'Public'), o('私立', '私立', 'Private'), o('Homeschool', 'Homeschool（在家教育）', 'Homeschool'), o('其他', '其他', 'Other', true)] }),
    q('q14', 'single', '当前年级', 'CURRENT GRADE', { required: true, mapTo: 'grade', options: [o('G8', 'G8', 'Grade 8'), o('G9', 'G9', 'Grade 9'), o('G10', 'G10', 'Grade 10'), o('G11', 'G11', 'Grade 11'), o('G12', 'G12', 'Grade 12'), o('其他', '其他', 'Other', true)] }),
    q('s4', 'section', '监护人信息', 'GUARDIAN INFORMATION', { helpZh: '请填写赛事报名过程中可联系到的监护人。', helpEn: 'A guardian we can reach during registration.' }),
    q('q15', 'text', '监护人姓名（中英文）', 'GUARDIAN NAME (CHINESE & PINYIN)', { required: true, mapTo: 'guardianName', helpZh: '中文姓名 + 护照拼音；请特别核对拼音及姓名顺序。', helpEn: 'Chinese name + passport pinyin; check spelling and name order.' }),
    q('q16', 'phone', '监护人手机号', 'GUARDIAN MOBILE', { required: true, mapTo: 'guardianPhone', helpZh: '含国家/地区代码（大陆号码可直接填写）。', helpEn: 'Include the country/region code (not needed for mainland numbers).' }),
    q('q17', 'email', '监护人邮箱', 'GUARDIAN EMAIL', { required: true, mapTo: 'guardianEmail' }),
    q('s5', 'section', '语言成绩', 'LANGUAGE SCORES', { helpZh: '如有语言成绩，请勾选考试类型并填写总分与口语分；暂无成绩可勾选“暂无”。', helpEn: 'If you have a score, choose the test and give the total and speaking scores; otherwise choose “None yet”.' }),
    q('q18', 'single', '语言成绩 · 考试类型（选填）', 'LANGUAGE TEST (OPTIONAL)', { mapTo: 'languageTest', helpZh: '如选“其他”，请注明考试名称。', helpEn: 'If “Other”, name the test.', options: [o('TOEFL', 'TOEFL 托福', 'TOEFL'), o('IELTS', 'IELTS 雅思', 'IELTS'), o('其他', '其他', 'Other', true), o('暂无', '暂无', 'None yet')] }),
    q('q18b', 'text', '总分', 'TOTAL SCORE', { mapTo: 'languageTotal' }),
    q('q18c', 'text', '口语分数', 'SPEAKING SCORE', { mapTo: 'languageSpeaking' }),
    q('s6', 'section', '个人补充信息', 'ADDITIONAL INFORMATION', { helpZh: '以下项目选填，便于整理学生资料或完成赛事报名表中的背景信息。', helpEn: 'Optional — helps us complete background sections of the registration.' }),
    q('q19', 'select', 'MBTI（选填）', 'MBTI (OPTIONAL)', { mapTo: 'mbti', options: [...['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'].map(t => o(t, t, t)), o('不确定', '不确定', 'Not sure')] }),
    q('q20', 'textarea', '过往竞赛经历（选填）', 'PAST COMPETITIONS (OPTIONAL)', { mapTo: 'pastCompetitions', helpZh: '请写竞赛名称、年份/赛季、参赛项目或组别。', helpEn: 'Competition name, year/season, event or division.' }),
    q('q21', 'textarea', '获奖情况（选填）', 'AWARDS (OPTIONAL)', { mapTo: 'awardsA', helpZh: '请写奖项名称、等级、获奖年份及颁发机构；如无可留空。', helpEn: 'Award name, level, year and issuing organisation; leave blank if none.' }),
    q('q22', 'textarea', '其他报名补充说明', 'OTHER NOTES', { mapTo: 'formNote', helpZh: '如英文姓名曾变更、证件更新中、学校英文名需确认等。', helpEn: 'E.g. a changed English name, ID being renewed, school English name to confirm.' }),
    q('s7', 'section', '填写前请核对', 'PLEASE CHECK BEFORE SUBMITTING'),
    q('q23', 'multi', '提交前确认', 'CONFIRMATION', { required: true, requireAll: true, options: [
      o('证件一致', '姓名拼音、证件号码、出生日期与报名证件一致；邮箱和手机号可正常联系。', 'Name pinyin, ID number and date of birth match the ID; email and phone are reachable.'),
      o('英文地址', '居住地址及学校地址使用英文填写，并包含邮政编码；学校名称使用官方全称。', 'Home and school addresses are in English with postal codes; the school name is the official full name.'),
      o('如实填写', '语言成绩应与成绩单一致；竞赛经历和奖项按真实情况填写，选填项可留空。', 'Language scores match the transcript; competitions and awards are truthful. Optional fields may be left blank.'),
      o('共同核对', '请由学生与监护人共同核对后提交。', 'Checked together by the student and guardian.')] }),
  ],
};

// ---------------------------------------------------------------- validation
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Mainland 11-digit mobile, or an international number with + / 00 country code (7–15 digits). */
export function phoneIssue(v: string): string | null {
  const t = v.replace(/[\s()-]/g, '');
  if (/^1[3-9]\d{9}$/.test(t)) return null;
  if (/^(\+|00)\d{6,15}$/.test(t)) return null;
  return '请输入有效手机号（大陆 11 位；其他地区请加国家/地区代码，如 +852）';
}
export const digitsOf = (v: string) => v.replace(/\D/g, '').replace(/^(86|0086)(1[3-9]\d{9})$/, '$2');
const isEmpty = (v: AnswerValue | undefined) => v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === '');

/** Option value from a stored answer string ("其他：xxx" → 其他). */
export const optionPart = (v: string) => v.split(OTHER_SEP)[0];

/**
 * Validate and normalise raw answers against the questions. Returns per-question errors (Chinese) and the cleaned values.
 * Unknown ids are dropped; strings trimmed and capped; options must exist.
 */
export function validateAnswers(questions: FormQuestion[], raw: Record<string, unknown>): { errors: Record<string, string>; values: Record<string, AnswerValue> } {
  const errors: Record<string, string> = {}, values: Record<string, AnswerValue> = {};
  for (const qu of questions) {
    if (qu.type === 'section') continue;
    const r = raw[qu.id];
    let v: AnswerValue;
    if (qu.type === 'multi') {
      const arr = Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string').map(x => x.trim().slice(0, 300)).filter(Boolean) : [];
      v = [...new Set(arr)];
    } else v = typeof r === 'string' ? r.trim().slice(0, qu.type === 'textarea' ? 4000 : 500) : typeof r === 'number' ? String(r) : '';
    if (isEmpty(v)) { if (qu.required) errors[qu.id] = qu.type === 'multi' || qu.type === 'single' || qu.type === 'select' ? '请选择' : '此项为必填'; continue; }
    if (hasOptions(qu.type)) {
      const list = Array.isArray(v) ? v : [v];
      for (const x of list) {
        const opt = qu.options.find(op => op.value === optionPart(x));
        if (!opt) { errors[qu.id] = '选项无效'; break; }
        if (opt.other && !x.slice(opt.value.length + OTHER_SEP.length).trim()) { errors[qu.id] = `请填写「${opt.zh}」的具体内容`; break; }
        if (!opt.other && x !== opt.value) { errors[qu.id] = '选项无效'; break; }
      }
      if (!errors[qu.id] && qu.type === 'multi' && qu.requireAll && (v as string[]).length < qu.options.length) errors[qu.id] = '请逐项核对并全部勾选';
      if (errors[qu.id]) continue;
    }
    if (qu.type === 'email' && !EMAIL.test(v as string)) { errors[qu.id] = '邮箱格式不正确'; continue; }
    if (qu.type === 'phone') { const p = phoneIssue(v as string); if (p) { errors[qu.id] = p; continue; } }
    if (qu.type === 'date') {
      const d = v as string;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d + 'T00:00:00Z')) || d < '1900-01-01' || d > '2100-12-31') { errors[qu.id] = '请选择有效日期'; continue; }
    }
    if (qu.type === 'number' && !/^-?\d+(\.\d+)?$/.test(v as string)) { errors[qu.id] = '请输入数字'; continue; }
    values[qu.id] = v;
  }
  return { errors, values };
}

/** Label snapshot for storage: answers stay readable after questions change. */
export function snapshotAnswers(questions: FormQuestion[], values: Record<string, AnswerValue>): AnswerSnapshot[] {
  return questions.filter(qu => qu.type !== 'section' && values[qu.id] !== undefined)
    .map(qu => ({ id: qu.id, type: qu.type, labelZh: qu.labelZh, labelEn: qu.labelEn, mapTo: qu.mapTo, value: values[qu.id] }));
}
export const answerText = (v: AnswerValue | undefined) => v == null ? '' : Array.isArray(v) ? v.join('、') : v;

/** 「程雪晴 CHENG XUEQING」 → { zh: 程雪晴, en: CHENG XUEQING }. */
export function splitName(raw: string): { zh: string; en: string } {
  const t = raw.trim().replace(/\s+/g, ' ');
  const m = t.match(/^([\u3400-\u9fff·•]+)\s*(.*)$/);
  if (m) return { zh: m[1], en: m[2].trim() };
  return { zh: t, en: '' };
}
/** Name + phone used for list display and duplicate checks. */
export function identityOf(answers: AnswerSnapshot[]) {
  const by = (k: string) => answerText(answers.find(a => a.mapTo === k)?.value);
  return { name: splitName(by('name')).zh || by('name'), phone: by('phone') };
}

// ---------------------------------------------------------------- 队伍绑定分发
export type StudentLike = { id: string; name: string; program: string; team: string; status: string; sales: string; updated: string; grade: string; health: string; healthNote: string; healthUpdated: string; healthBy: string; profile?: Record<string, string> | null };
export type EnrollmentLike = { id: string; student: string; program: string; team: string; status: string };
export type DuplicateMatch = { studentId: string; name: string; phone: string; strength: 'name+phone' | 'phone' | 'name' };

/** Existing students that look like the submitter: same name + phone (strong), same phone, or same name. */
export function findDuplicates(sub: Pick<Submission, 'name' | 'phone'>, students: StudentLike[]): DuplicateMatch[] {
  const name = sub.name.trim(), phone = digitsOf(sub.phone);
  const out: DuplicateMatch[] = [];
  for (const s of students) {
    const sName = splitName(s.name).zh || s.name.trim(), sPhone = digitsOf(s.profile?.phone || '');
    const nm = !!name && sName === name, pm = phone.length >= 6 && sPhone === phone;
    if (nm && pm) out.push({ studentId: s.id, name: s.name, phone: s.profile?.phone || '', strength: 'name+phone' });
    else if (pm) out.push({ studentId: s.id, name: s.name, phone: s.profile?.phone || '', strength: 'phone' });
    else if (nm) out.push({ studentId: s.id, name: s.name, phone: s.profile?.phone || '', strength: 'name' });
  }
  const rank = { 'name+phone': 0, phone: 1, name: 2 } as const;
  return out.sort((a, b) => rank[a.strength] - rank[b.strength]);
}

/** Map answers onto the student record: { name, grade, profile, extras }. Unmapped answers become 表单补充信息. */
export function profileFromAnswers(answers: AnswerSnapshot[]) {
  const profile: Record<string, string> = {};
  const extras: string[] = [];
  let name = '', grade = '';
  for (const a of answers) {
    const text = answerText(a.value);
    if (!text) continue;
    if (a.mapTo === 'name') { const n = splitName(text); name = n.zh || text; if (n.en) profile.nameEn = n.en; continue; }
    if (a.mapTo === 'grade') { grade = text.replace(/^其他：/, ''); continue; }
    if (a.mapTo && TARGET_KEYS.has(a.mapTo)) { profile[a.mapTo] = profile[a.mapTo] ? profile[a.mapTo] + '；' + text : text; continue; }
    if (a.type === 'multi' && a.mapTo === '' && /确认|CONFIRM/i.test(a.labelZh + a.labelEn)) continue; // 提交前核对: no profile value
    extras.push(`${a.labelZh}：${text}`);
  }
  const lang = [profile.languageTest, profile.languageTotal && '总分 ' + profile.languageTotal, profile.languageSpeaking && '口语 ' + profile.languageSpeaking].filter(Boolean).join(' · ');
  if (lang) profile.toeflIelts = lang;
  if (extras.length) profile.formExtras = extras.join('\n');
  return { name, grade, profile };
}

/** `sales` = the sales account's name (students.sales is matched by salesOwns against users.name / salesName). */
export type AssignTarget = { program: string; team: string; sales?: string; enrollStatus?: string };
export type AssignPlan = { student: StudentLike; created: boolean; enrollment: EnrollmentLike; enrollmentCreated: boolean };
/**
 * Plan one 队伍绑定分发: create a new 学生 (or link to `linkTo`), merge mapped form fields into the profile without
 * overwriting values already on file, and add / move the program enrollment into the chosen team.
 */
export function planAssignment(sub: Pick<Submission, 'id' | 'answers' | 'createdAt'>, target: AssignTarget, ctx: {
  students: StudentLike[]; enrollments: EnrollmentLike[]; linkTo?: string | null; by: string; stamp: string; newId: string;
}): AssignPlan {
  const mapped = profileFromAnswers(sub.answers);
  const status = target.enrollStatus || '待开课';
  const existing = ctx.linkTo ? ctx.students.find(s => s.id === ctx.linkTo) : undefined;
  if (ctx.linkTo && !existing) throw new Error('link_target_missing');
  const source = { source: '报名收集表', filledAt: sub.createdAt.slice(0, 16).replace('T', ' '), formSubmission: sub.id };
  let student: StudentLike, created: boolean;
  if (existing) {
    const profile: Record<string, string> = { ...(existing.profile || {}) };
    for (const [k, v] of Object.entries({ ...mapped.profile, ...source })) if (!profile[k] || !String(profile[k]).trim()) profile[k] = v;
    // A chosen salesperson always wins (re-binding); the primary team moves when it is empty or in the same project.
    const moveTeam = !existing.team || existing.program === target.program;
    student = { ...existing, profile, grade: existing.grade || mapped.grade, team: moveTeam ? target.team : existing.team, program: existing.program || target.program, sales: target.sales || existing.sales || '', updated: '刚刚' };
    created = false;
  } else {
    student = { id: ctx.newId, name: mapped.name || sub.answers.find(a => a.mapTo === 'name')?.value as string || '未命名学生', program: target.program, team: target.team, status, sales: target.sales || '', updated: '刚刚', grade: mapped.grade, health: '状态良好', healthNote: '报名收集表导入，待首次学习评估。', healthUpdated: ctx.stamp, healthBy: ctx.by, profile: { ...mapped.profile, ...source } };
    created = true;
  }
  const prior = ctx.enrollments.find(e => e.student === student.id && e.program === target.program);
  const enrollment: EnrollmentLike = prior ? { ...prior, team: target.team, status: prior.status || status } : { id: 'E-' + student.id + '-' + target.program, student: student.id, program: target.program, team: target.team, status };
  return { student, created, enrollment, enrollmentCreated: !prior };
}

// ---------------------------------------------------------------- export
/** Columns = union of question labels across submissions (snapshot order of the newest form first). */
export function submissionTable(subs: Submission[], programName: (id: string) => string = x => x, teamName: (id: string) => string = x => x): string[][] {
  const cols: { id: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const s of subs) for (const a of s.answers) if (!seen.has(a.id)) { seen.add(a.id); cols.push({ id: a.id, label: a.labelZh }); }
  const head = ['提交时间', '状态', '分配项目', '分配队伍', ...cols.map(c => c.label)];
  const rows = subs.map(s => [s.createdAt.replace('T', ' ').slice(0, 16), s.status, s.program ? programName(s.program) : '', s.team ? teamName(s.team) : '', ...cols.map(c => answerText(s.answers.find(a => a.id === c.id)?.value))]);
  return [head, ...rows];
}
export function toCsv(rows: string[][]): string {
  const cell = (v: string) => /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  return '\uFEFF' + rows.map(r => r.map(x => cell(String(x ?? ''))).join(',')).join('\r\n');
}

/** Public slug: lowercase letters/digits/hyphen, 4–60 chars. */
export const isFormSlug = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{3,59}$/.test(v);
