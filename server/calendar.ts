/**
 * Personal course calendar: public ICS feed by secret token + authenticated subscribe management.
 * Feed path: GET /api/calendar/:token.ics (no login — Apple Calendar fetches by URL only).
 * Management: GET/POST /api/calendar/subscription (bearer token).
 */
import type { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Db } from './db';
import { schema } from './db';
import {
  buildCalendarIcs,
  calendarEventsFor,
  calendarSubscribeUrls,
  coursesForCalendarOwner,
  normalizeCalendarToken,
  type CalendarEvent,
} from '../lib/nexus/calendar';
import type { Role } from '../lib/nexus/roles';
import type { CourseSession } from '../lib/nexus/schedule';

type SessionUser = { id: number; email: string; name: string; role: Role };
/** Loose app type so register* can accept the main Hono<Env> from app.ts (same pattern as posts/forms). */
type AnyApp = Hono<any, any, any>;

const clean = <T extends Record<string, unknown>>(row: T) => {
  const out = { ...row } as Record<string, unknown>;
  delete out.createdAt; delete out.updatedAt; delete out.sortOrder;
  return out;
};

function mintToken() {
  return randomBytes(24).toString('base64url');
}

async function ensureToken(db: Db, userId: number): Promise<string> {
  const [row] = await db.select({ token: schema.users.calendarFeedToken }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (row?.token) return row.token;
  for (let i = 0; i < 5; i++) {
    const token = mintToken();
    try {
      await db.update(schema.users).set({ calendarFeedToken: token, updatedAt: new Date() }).where(eq(schema.users.id, userId));
      return token;
    } catch {
      /* unique collision — retry */
    }
  }
  throw new Error('calendar_token_mint_failed');
}

async function rotateToken(db: Db, userId: number): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const token = mintToken();
    try {
      await db.update(schema.users).set({ calendarFeedToken: token, updatedAt: new Date() }).where(eq(schema.users.id, userId));
      return token;
    } catch { /* retry */ }
  }
  throw new Error('calendar_token_rotate_failed');
}

function originOf(c: { req: { header: (n: string) => string | undefined } }, publicOrigin: string) {
  if (publicOrigin) return publicOrigin;
  const proto = (c.req.header('x-forwarded-proto') || 'https').split(',')[0]!.trim();
  const host = (c.req.header('x-forwarded-host') || c.req.header('host') || 'bestcrm.cc').split(',')[0]!.trim();
  return `${proto}://${host}`;
}

async function loadOwnedEvents(db: Db, owner: { name: string; email: string; role: Role }): Promise<{ events: CalendarEvent[]; calName: string }> {
  const [courses, sessions, opsCourses, teams, programs] = await Promise.all([
    db.select().from(schema.courses),
    db.select().from(schema.courseSessions),
    db.select().from(schema.opsCourses),
    db.select().from(schema.teams),
    db.select().from(schema.programs),
  ]);
  const courseRows = courses.map(r => clean(r as unknown as Record<string, unknown>)) as unknown as {
    id: string; name: string; program: string; teacher: string; date: string; time: string; status: string; code?: string; location?: string; team?: string;
  }[];
  const sessionRows = sessions.map(r => {
    const x = clean(r as unknown as Record<string, unknown>) as Record<string, unknown>;
    // schema maps course_id → course, start_time → start, end_time → end
    return {
      id: String(x.id),
      course: String(x.course),
      date: String(x.date),
      start: String(x.start),
      end: String(x.end),
      location: x.location != null ? String(x.location) : undefined,
      title: x.title != null ? String(x.title) : undefined,
      content: x.content != null ? String(x.content) : undefined,
    } as CourseSession;
  });
  const opsRows = opsCourses.map(r => clean(r as unknown as Record<string, unknown>)) as unknown as {
    id: string; code: string; teacher: string; opsTeacher: string; name: string;
  }[];
  const teamRows = teams.map(r => ({ id: r.id, name: r.name, teacher: r.teacher }));
  const programRows = programs.map(r => ({ id: r.id, name: r.name, short: r.short }));
  const mine = coursesForCalendarOwner(
    { name: owner.name, email: owner.email, role: owner.role },
    { opsCourses: opsRows, courses: courseRows, teams: teamRows },
  );
  const events = calendarEventsFor(mine, sessionRows, { teams: teamRows, programs: programRows });
  return { events, calName: `BEST课表 · ${owner.name}` };
}

function icsResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="best-courses.ics"',
      'Cache-Control': 'private, max-age=300',
    },
  });
}

/** Public feed — register BEFORE the auth middleware. Path must end with .ics so it never shadows /calendar/subscription. */
export function registerPublicCalendarRoutes(app: AnyApp, db: Db, publicOrigin = '') {
  app.get('/calendar/:token{[A-Za-z0-9_-]+\.ics}', async c => {
    const token = normalizeCalendarToken(c.req.param('token'));
    if (!token) return c.json({ error: 'not_found' }, 404);
    const [user] = await db.select().from(schema.users)
      .where(eq(schema.users.calendarFeedToken, token)).limit(1);
    if (!user || !user.active) return c.json({ error: 'not_found' }, 404);
    if (user.role === 'sales') return c.json({ error: 'not_found' }, 404);
    const { events, calName } = await loadOwnedEvents(db, {
      name: user.name, email: user.email, role: user.role as Role,
    });
    const ics = buildCalendarIcs({ calName, events });
    return icsResponse(ics);
  });
}

/** Authenticated subscribe URL management — register AFTER auth middleware. */
export function registerCalendarRoutes(app: AnyApp, db: Db, publicOrigin = '') {
  app.get('/calendar/subscription', async c => {
    const user = c.get('user');
    if (user.role === 'sales') {
      return c.json({ error: 'forbidden', message: '课表日历订阅仅对运营老师 / 授课老师开放' }, 403);
    }
    const token = await ensureToken(db, user.id);
    const urls = calendarSubscribeUrls(originOf(c, publicOrigin), token);
    return c.json({ token, ...urls });
  });

  app.post('/calendar/subscription/regenerate', async c => {
    const user = c.get('user');
    if (user.role === 'sales') {
      return c.json({ error: 'forbidden', message: '课表日历订阅仅对运营老师 / 授课老师开放' }, 403);
    }
    const token = await rotateToken(db, user.id);
    const urls = calendarSubscribeUrls(originOf(c, publicOrigin), token);
    return c.json({ token, ...urls, regenerated: true as const });
  });
}
