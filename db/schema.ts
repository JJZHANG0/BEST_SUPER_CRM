/**
 * PostgreSQL schema for the PROJECT NEXUS API (server/). Column names are snake_case;
 * the API maps rows to the same shapes the frontend already uses (lib/nexus/data.ts).
 * Generate migrations with `npm run db:generate` after editing this file.
 */
import { boolean, doublePrecision, index, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

const stamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  /** 'superadmin' | 'ops' | 'sales' | 'admin' (see lib/nexus/roles.ts) */
  role: text('role').notNull(),
  /** For sales users: the advisor label stored on students.sales (e.g. 顾问 Alex). */
  salesName: text('sales_name'),
  active: boolean('active').notNull().default(true),
  /** Set for seeded / admin-created / reset accounts; cleared when the user changes the password. */
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  ...stamps,
});

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
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
});

/** 队伍 / cohorts. */
export const teams = pgTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  program: text('program').notNull().references(() => programs.id),
  teacher: text('teacher').notNull(),
  stage: integer('stage').notNull(),
  status: text('status').notNull(),
  note: text('note').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
});

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
  sortOrder: integer('sort_order').notNull().default(0),
  ...stamps,
});

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
  ...stamps,
}, t => [index('todos_user_idx').on(t.userId), index('todos_user_open_idx').on(t.userId, t.completedAt)]);

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

/** 课时记录. rate / unit snapshot the class type when the record is created; amount is computed by the API. */
export const lessonRecords = pgTable('lesson_records', {
  id: text('id').primaryKey(),
  course: text('course').notNull().references(() => opsCourses.id),
  date: text('date').notNull(),
  hours: doublePrecision('hours').notNull(),
  students: integer('students'),
  opsTeacher: text('ops_teacher').notNull(),
  rate: doublePrecision('rate').notNull(),
  unit: text('unit').notNull(),
  amount: doublePrecision('amount').notNull(),
  note: text('note').notNull().default(''),
  createdBy: text('created_by').notNull().default(''),
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
