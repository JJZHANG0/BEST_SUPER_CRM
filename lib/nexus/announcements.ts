/**
 * 项目公告: audience targeting + read receipts.
 * Runtime-import free (types only from roles) so the API server can load helpers if needed.
 */
export const ANNOUNCEMENT_AUDIENCES = ['all', 'ops', 'teachers', 'selected_teachers', 'selected'] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  all: '对所有人',
  ops: '对全体运营',
  teachers: '对全体老师',
  selected_teachers: '自选老师',
  selected: '自选留言对象',
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  tag: string;
  program: string | null;
  audience: AnnouncementAudience;
  recipientIds: number[];
  authorId: number;
  authorName: string;
  /** Asia/Shanghai display stamp (YYYY-MM-DD HH:mm). */
  date: string;
  createdAt: string;
  /** Whether the current user has read this announcement. */
  read: boolean;
  /** Present for the author: how many intended recipients have read / total. */
  readCount?: number;
  recipientCount?: number;
};

export type AnnouncementDirectoryUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export type AnnouncementReadRow = {
  userId: number;
  name: string;
  email: string;
  role: string;
  read: boolean;
  readAt: string | null;
};

export const isAudience = (v: unknown): v is AnnouncementAudience =>
  typeof v === 'string' && (ANNOUNCEMENT_AUDIENCES as readonly string[]).includes(v);

/** Whether a user (by role) is in the audience for a broadcast / selected list. */
export function isRecipient(
  audience: AnnouncementAudience,
  recipientIds: readonly number[],
  user: { id: number; role: string },
): boolean {
  if (audience === 'all') return true;
  if (audience === 'ops') return user.role === 'ops' || user.role === 'superadmin' || user.role === 'admin';
  if (audience === 'teachers') return user.role === 'teacher';
  return recipientIds.includes(user.id);
}
