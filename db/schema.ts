/**
 * PostgreSQL schema for the PROJECT NEXUS API (server/). Column names are snake_case;
 * the API maps rows to the same shapes the frontend already uses (lib/nexus/data.ts).
 * Generate migrations with `npm run db:generate` after editing this file.
 */
import { sql } from 'drizzle-orm';
import { boolean, doublePrecision, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

const stamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  /** Login name (usually the person's name, e.g. 张捷嘉). Unique case-insensitively; email remains an alternative login. */
  username: text('username'),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  /** 'superadmin' | 'ops' | 'sales' | 'admin' (see lib/nexus/roles.ts) */
  role: text('role').notNull(),
  /** For sales users: the advisor label stored on students.sales (e.g. 顾问 Alex). */
  salesName: text('sales_name'),
  active: boolean('active').notNull().default(true),
  /** Set for seeded / admin-created / reset accounts; cleared when the user changes the password. */
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  /** 部门负责人 (department head): all teachers' 课时/津贴, 绩效考核, 任务指派; does not fill 当月绩效. Only 张捷嘉. */
  leader: boolean('leader').notNull().default(false),
  /** Own avatar as a data URL (Pages + API). */
  avatar: text('avatar'),
  /** Accent theme id (see lib/nexus/themes.ts). */
  theme: text('theme').notNull().default('amethyst'),
  /** Preferred city for workbench weather (default 杭州). */
  weatherCity: text('weather_city').notNull().default('杭州'),
  /** Floating desktop pet id (see lib/nexus/pets.ts). */
  pixelPet: text('pixel_pet').notNull().default('rabbit'),
  /** 销售区域 (sales users): 销售大部 | 商务拓展一区 | 商务拓展二区 | 商务拓展三区 (lib/nexus/roles.ts SALES_REGIONS). */
  salesRegion: text('sales_region'),
  /** 销售负责人 (区/部 manager, e.g. 杨巍, 胡晓贇) — informational for stats; grants no extra rights. */
  salesLead: boolean('sales_lead').notNull().default(false),
  ...stamps,
}, t => [uniqueIndex('users_username_lower_idx').on(sql`lower(${t.username})`)]);

export const programs = pgTable('programs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  en: text('en').notNull(),
  short: text('short').notNull(),
  type: text('type').notNull(),
  color: text('color').notNull(),
  description: text('description').notNull(),
  date: text('date').notNull(),
  status: text('status').notNull(),
  curriculum: text('curriculum').notNull(),
  /** Ops-only unpublished curriculum draft. */
  draft: text('draft'),
  published: boolean('published').notNull().default(false),
  /** 招生目标 / 已招生人数 from the 「2026 BEST 项目招生总览」 sheet (营收总览); NULL = not provided. */
  recruitTarget: integer('recruit_target'),
  recruitEnrolled: integer('recruit_enrolled'),
  recruitSource: text('recruit_source'),
  recruitFlag: text('recruit_flag'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
});

/** 队伍 / cohorts. */
export const teams = pgTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  program: text('program').notNull().references(() => programs.id),
  teacher: text('teacher').notNull(),
  /** 0 = 未设定（仅部门负责人/项目经理后续创建阶段） */
  stage: integer('stage').notNull(),
  status: text('status').notNull(),
  note: text('note').notNull().default(''),
  /** 队伍进度 fields filled by 队伍老师 / 运营老师 */
  progress: jsonb('progress').$type<{ summary?: string; milestones?: string; risks?: string; updated?: string; updatedBy?: string }>(),
  /** 成果材料 */
  materials: jsonb('materials').$type<{ checklist?: string; links?: string; notes?: string; updated?: string; updatedBy?: string }>(),
  /** 招募 facts from the 项目超级管理 sheet: 招募状态 (火热招募 / 正常招募 / 招生结束), seats, 课题海报 and 课程计划 images. */
  recruitStatus: text('recruit_status'),
  recruitCapacity: integer('recruit_capacity'),
  recruitEnrolled: integer('recruit_enrolled'),
  recruitRemaining: integer('recruit_remaining'),
  posterUrl: text('poster_url'),
  scheduleUrl: text('schedule_url'),
  sheetRef: text('sheet_ref'),
  opsOwner: text('ops_owner'),
  archived: boolean('archived').default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
});

/** Immutable 运营记录 for team changes (who / when / what). */
export const teamLogs = pgTable('team_logs', {
  id: text('id').primaryKey(),
  team: text('team').notNull().references(() => teams.id),
  at: text('at').notNull(),
  by: text('by').notNull().default(''),
  byName: text('by_name').notNull(),
  action: text('action').notNull(),
  detail: text('detail').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
}, t => [index('team_logs_team_idx').on(t.team)]);

export const students = pgTable('students', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  program: text('program').notNull().references(() => programs.id),
  team: text('team').notNull().default(''),
  status: text('status').notNull(),
  sales: text('sales').notNull(),
  updated: text('updated').notNull(),
  grade: text('grade').notNull(),
  /** 学生状态: 状态不佳 | 需关注 | 状态良好 */
  health: text('health').notNull(),
  healthNote: text('health_note').notNull().default(''),
  /** Display stamp (MM-DD HH:mm, Asia/Shanghai) kept for the UI. */
  healthUpdated: text('health_updated').notNull().default(''),
  healthBy: text('health_by').notNull().default(''),
  healthChangedAt: timestamp('health_changed_at', { withTimezone: true }),
  healthChangedBy: integer('health_changed_by').references(() => users.id),
  /** Extra 花名册 fields (union schema across projects). */
  profile: jsonb('profile').$type<Record<string, string>>(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
}, t => [index('students_sales_idx').on(t.sales)]);

/** Audit trail: every change of a student's status, who made it and when. */
export const studentStatusHistory = pgTable('student_status_history', {
  id: serial('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id),
  health: text('health').notNull(),
  healthNote: text('health_note').notNull().default(''),
  previousHealth: text('previous_health'),
  changedBy: integer('changed_by').references(() => users.id),
  changedByName: text('changed_by_name').notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('student_status_history_student_idx').on(t.studentId)]);

export const enrollments = pgTable('enrollments', {
  id: text('id').primaryKey(),
  student: text('student').notNull().references(() => students.id),
  program: text('program').notNull().references(() => programs.id),
  team: text('team').notNull().default(''),
  status: text('status').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
});

export const courses = pgTable('courses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  program: text('program').notNull().references(() => programs.id),
  team: text('team').notNull(),
  teacher: text('teacher').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  status: text('status').notNull(),
  /** 课程编号 / 教室或线上 (optional; shown on the exported timetable). */
  /** 「强制设定」: saved despite 排课冲突 (授课老师 / 运营老师 / team / room overlap). */
  conflictOverride: boolean('conflict_override'),
  code: text('code'),
  location: text('location'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
});

/**
 * 课程排课: each meeting of a course (weekly recurrence or manual dates). course_id is not a foreign key on
 * purpose: the browser writes a new course and its sessions in parallel.
 */
export const courseSessions = pgTable('course_sessions', {
  id: text('id').primaryKey(),
  course: text('course_id').notNull(),
  date: text('date').notNull(),
  start: text('start_time').notNull(),
  end: text('end_time').notNull(),
  location: text('location'),
  title: text('title'),
  content: text('content'),
  handouts: text('handouts'),
  homework: text('homework'),
  slides: text('slides'),
  references: text('reference_materials'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
}, t => [index('course_sessions_course_idx').on(t.course), index('course_sessions_date_idx').on(t.date), uniqueIndex('course_sessions_course_slot_uq').on(t.course, t.date, t.start)]);

/** 教学反馈 */
export const feedbacks = pgTable('feedbacks', {
  id: text('id').primaryKey(),
  student: text('student').notNull().references(() => students.id),
  course: text('course').notNull().default(''),
  content: text('content').notNull(),
  next: text('next').notNull().default(''),
  visible: boolean('visible').notNull().default(true),
  date: text('date').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
});

/** Homework / assignments shown on the student detail page. */
export const assignments = pgTable('assignments', {
  id: text('id').primaryKey(),
  student: text('student').notNull().references(() => students.id),
  program: text('program').notNull(),
  title: text('title').notNull(),
  due: text('due').notNull(),
  submitted: text('submitted'),
  status: text('status').notNull(),
  score: integer('score'),
  feedback: text('feedback').notNull().default(''),
  teacher: text('teacher').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
}, t => [index('assignments_student_idx').on(t.student)]);

/** 资料中心 metadata (files themselves live in public/materials). */
export const resources = pgTable('resources', {
  id: text('id').primaryKey(),
  program: text('program').notNull().references(() => programs.id),
  name: text('name').notNull(),
  type: text('type').notNull(),
  format: text('format').notNull(),
  size: text('size').notNull(),
  public: boolean('public').notNull().default(false),
  file: text('file'),
  /** Optional 资料中心 folder (resource_folders.id). */
  folder: text('folder'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
});

/** 项目推文: one article per programme with an editable draft and a published snapshot. */
export const articles = pgTable('articles', {
  program: text('program').primaryKey().references(() => programs.id),
  author: text('author').notNull(),
  draft: jsonb('draft').notNull(),
  published: jsonb('published'),
  updated: text('updated').notNull(),
  publishedAt: text('published_at'),
  updatedBy: integer('updated_by').references(() => users.id),
  ...stamps,
});

/** Ops / sales personal todos (待办). Scoped per user; completedAt set when checked off. */
export const todos = pgTable('todos', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  note: text('note'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  /** 任务指派: the superadmin who assigned this todo to user_id (null for personal todos). */
  assignedBy: integer('assigned_by').references(() => users.id),
  assignedByName: text('assigned_by_name'),
  ...stamps,
}, t => [index('todos_user_idx').on(t.userId), index('todos_user_open_idx').on(t.userId, t.completedAt), index('todos_assigned_by_idx').on(t.assignedBy)]);

/**
 * 当月绩效 / 绩效考核: one KPI sheet per user and month (YYYY-MM). items holds the fixed KR slots
 * (lib/nexus/kpi.ts). status: draft → submitted → finalized (reviewer may return or reopen).
 */
export const kpiSheets = pgTable('kpi_sheets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  month: text('month').notNull(),
  status: text('status').notNull().default('draft'),
  items: jsonb('items').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedByName: text('reviewed_by_name'),
  reviewNote: text('review_note').notNull().default(''),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  total: doublePrecision('total'),
  ...stamps,
}, t => [uniqueIndex('kpi_sheets_user_month_idx').on(t.userId, t.month), index('kpi_sheets_month_idx').on(t.month)]);

/** 班级类型 + 教务津贴标准. unit: 'hour' (元/小时) | 'person_hour' (元/人/小时) | 'session' (元/次). */
export const classTypes = pgTable('class_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  rate: doublePrecision('rate').notNull(),
  unit: text('unit').notNull(),
  note: text('note').notNull().default(''),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
});

/** 项目 with 项目编号 (e.g. COND2025001). */
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  startDate: text('start_date').notNull().default(''),
  endDate: text('end_date').notNull().default(''),
  /** 未开始 | 进行中 | 已结束 */
  status: text('status').notNull(),
  note: text('note').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
});

/** 课程 with 课程编号 (e.g. COND02501-11A); 教务老师 is stored as the teacher's login email. */
export const opsCourses = pgTable('ops_courses', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  project: text('project').notNull().references(() => projects.id),
  name: text('name').notNull(),
  status: text('status').notNull(),
  classType: text('class_type').notNull().references(() => classTypes.id),
  teacher: text('teacher').notNull().default(''),
  opsTeacher: text('ops_teacher').notNull().default(''),
  startDate: text('start_date').notNull().default(''),
  endDate: text('end_date').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
}, t => [index('ops_courses_project_idx').on(t.project), index('ops_courses_ops_teacher_idx').on(t.opsTeacher)]);

/** 授课老师 directory (系统管理 · 授课老师); seeded from the 课程编号管理 sheet. */
export const teachers = pgTable('teachers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  note: text('note').notNull().default(''),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
}, t => [uniqueIndex('teachers_name_idx').on(t.name)]);

/** 课时记录. rate / unit snapshot the class type when the record is created; amount is computed by the API. */
export const lessonRecords = pgTable('lesson_records', {
  id: text('id').primaryKey(),
  course: text('course').notNull().references(() => opsCourses.id),
  date: text('date').notNull(),
  hours: doublePrecision('hours').notNull(),
  /** 应到人数 (roster size when logged) / 实到人数 (drives 元/人/小时). Migration 0008 copied the old `students` into actual_count. */
  expectedCount: integer('expected_count'),
  actualCount: integer('actual_count'),
  opsTeacher: text('ops_teacher').notNull(),
  rate: doublePrecision('rate').notNull(),
  unit: text('unit').notNull(),
  amount: doublePrecision('amount').notNull(),
  note: text('note').notNull().default(''),
  createdBy: text('created_by').notNull().default(''),
  /** 授课老师 (prefilled from the course). NULL on older rows: the course's teacher is shown. */
  teacher: text('teacher'),
  /** 课程回放链接, copied into the parent-group 课程反馈. */
  replayUrl: text('replay_url').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
}, t => [index('lesson_records_ops_teacher_idx').on(t.opsTeacher, t.date), index('lesson_records_course_idx').on(t.course)]);

/** 课情反馈 per lesson, optionally linked to a 课时记录. */
export const lessonFeedbacks = pgTable('lesson_feedbacks', {
  id: text('id').primaryKey(),
  course: text('course').notNull().references(() => opsCourses.id),
  lesson: text('lesson'),
  date: text('date').notNull(),
  attendance: text('attendance').notNull().default(''),
  content: text('content').notNull().default(''),
  performance: text('performance').notNull().default(''),
  issues: text('issues').notNull().default(''),
  nextSteps: text('next_steps').notNull().default(''),
  opsTeacher: text('ops_teacher').notNull(),
  createdBy: text('created_by').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
}, t => [index('lesson_feedbacks_ops_teacher_idx').on(t.opsTeacher, t.date), index('lesson_feedbacks_course_idx').on(t.course)]);

/**
 * 推文: many per programme (project_id → programs.id), written by ops like WeChat Official Account
 * articles. status: draft → published → withdrawn. slug is the public URL key (/a/<slug>, #/p/<slug>).
 * views / shares / likes are server-owned counters, bumped by the public endpoints only.
 */
export const articlePosts = pgTable('article_posts', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  projectId: text('project_id').notNull().references(() => programs.id),
  status: text('status').notNull().default('draft'),
  author: text('author').notNull(),
  authorEmail: text('author_email').notNull().default(''),
  createdBy: integer('created_by').references(() => users.id),
  updatedBy: integer('updated_by').references(() => users.id),
  draft: jsonb('draft').notNull(),
  published: jsonb('published'),
  views: integer('views').notNull().default(0),
  shares: integer('shares').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  ...stamps,
}, t => [index('article_posts_project_idx').on(t.projectId), index('article_posts_status_idx').on(t.status)]);

/** Dedupe keys for public metrics: one row per (post, visitor, bucket); a counter moves only when the row is new. */
export const articlePostEvents = pgTable('article_post_events', {
  id: serial('id').primaryKey(),
  postId: text('post_id').notNull().references(() => articlePosts.id, { onDelete: 'cascade' }),
  visitor: text('visitor').notNull(),
  kind: text('kind').notNull(),
  bucket: text('bucket').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('article_post_events_dedupe_idx').on(t.postId, t.visitor, t.bucket), index('article_post_events_post_idx').on(t.postId)]);

/** 资料中心 folders under a programme (运营老师 create/edit). */
export const resourceFolders = pgTable('resource_folders', {
  id: text('id').primaryKey(),
  program: text('program').notNull().references(() => programs.id),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
}, t => [index('resource_folders_program_idx').on(t.program)]);

/**
 * 项目公告: ops-authored messages with audience targeting.
 * audience: all | ops | teachers | selected_teachers | selected
 * recipientIds holds user ids when audience is selected_* / selected.
 */
export const announcements = pgTable('announcements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  tag: text('tag').notNull().default('公告'),
  program: text('program').references(() => programs.id),
  audience: text('audience').notNull().default('all'),
  recipientIds: jsonb('recipient_ids').$type<number[]>().notNull().default(sql`'[]'::jsonb`),
  authorId: integer('author_id').notNull().references(() => users.id),
  authorName: text('author_name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
}, t => [index('announcements_author_idx').on(t.authorId)]);

/** Per-recipient read receipt for 项目公告. */
export const announcementReads = pgTable('announcement_reads', {
  announcementId: text('announcement_id').notNull().references(() => announcements.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('announcement_reads_pk').on(t.announcementId, t.userId),
  index('announcement_reads_user_idx').on(t.userId),
]);

/** Monthly CRM stickiness timer: accumulated active ms while on the workbench. */
export const workHours = pgTable('work_hours', {
  userId: integer('user_id').notNull().references(() => users.id),
  /** YYYY-MM in Asia/Shanghai */
  month: text('month').notNull(),
  totalMs: integer('total_ms').notNull().default(0),
  ...stamps,
}, t => [
  uniqueIndex('work_hours_user_month_idx').on(t.userId, t.month),
  index('work_hours_user_idx').on(t.userId),
]);

/**
 * 课时记录月度确认锁定: once ops confirms a YYYY-MM month, lesson create/edit/delete
 * for dates in that month is blocked for everyone except 张捷嘉.
 */
export const lessonMonthLocks = pgTable('lesson_month_locks', {
  month: text('month').primaryKey(),
  confirmedBy: text('confirmed_by').notNull(),
  confirmedByName: text('confirmed_by_name').notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull().defaultNow(),
  ...stamps,
});
