'use client';
import { Users, CalendarDays, Plus, FileText, MessageSquare, Clock, ChevronRight, Wallet } from 'lucide-react';
import { WorkbenchWelcomeTools } from './workbench-chrome';
import { WorkHoursCard, RedPacketCard, useMonthlyWorkHours } from './work-hours-card';
import { Badge, SectionTitle } from './ui';
import { TodoHomeCard } from './todos';
import { useMonthAllowance } from './ops-pages';
import { greeting } from './recruitment';
import { useNexus, useMe } from '@/lib/nexus/store';
import { money2, monthLabel, today as todayIso, teacherRosterScope } from '@/lib/nexus/ops';
import { type Program, type Student, type Team, type Course, type Role } from '@/lib/nexus/data';
import { occurrences, onDate, inWeek } from '@/lib/nexus/schedule';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Monday-first week containing `day` (YYYY-MM-DD). */
function weekOf(day: string) {
  const d = new Date(day + 'T12:00:00');
  const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(monday); x.setDate(monday.getDate() + i); return iso(x); });
}
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

export default function Dashboard({ programs, students, teams, courses, go }: { role: Role; programs: Program[]; students: Student[]; teams: Team[]; courses: Course[]; go: (v: string) => void }) {
  const s = useNexus(), me = useMe(), allowance = useMonthAllowance();
  const today = todayIso(), week = weekOf(today);
  // Sessions (课程排课) count individually; courses without sessions use their own date/time.
  const occ = occurrences(courses, s.courseSessions);
  const todays = onDate(occ, today);
  const thisWeek = inWeek(occ, today);
  const now = new Date(today + 'T12:00:00');
  const workHours = useMonthlyWorkHours();
  // L→R: 学生总数 → 本周课程 → 本月使用时长 → 本月红包提现 → 当月教务津贴
  const studentStat = { label: '学生总数', value: students.length, unit: '位', icon: Users, sub: students.length ? `${new Set(students.map(x => x.program)).size} 个项目有在读学生` : '暂无学生，点击新增', tone: 'violet', path: students.length ? 'students' : 'students/new' };
  const weekStat = { label: '本周课程', value: thisWeek.length, unit: '节', icon: CalendarDays, sub: `今天有 ${todays.length} 节课程`, tone: 'green', path: 'courses' };
  const allowanceStat = { label: allowance.team ? '当月教务津贴 · 团队' : '当月教务津贴', value: money2(allowance.amount), unit: '', icon: Wallet, sub: allowance.count ? `${monthLabel(allowance.month)}${allowance.team ? ' · 全部老师' : ''} · ${allowance.hours} 小时 · ${allowance.count} 条` : `${monthLabel(allowance.month)}暂无课时记录`, tone: 'orange', path: 'lessons' };
  return <>
    <div className="welcome"><div><div className="eyebrow">YOUR INNOVATION WORKSPACE</div><h1>{greeting()}，{me.name || '老师'} <span className="hello-spark">✧</span></h1><p>让每一个创新项目，都被高效推进。</p></div><WorkbenchWelcomeTools now={now} /></div>
    <div className="stats-grid five">
      <button className="stat-card glass" onClick={() => go(studentStat.path)}><div className="stat-top"><span>{studentStat.label}</span><span className={`stat-icon ${studentStat.tone}`}><Users size={19} /></span></div><div className="stat-value">{studentStat.value}{studentStat.unit && <span>{studentStat.unit}</span>}</div><div className="stat-foot"><span>{studentStat.sub}</span><ChevronRight size={14} /></div></button>
      <button className="stat-card glass" onClick={() => go(weekStat.path)}><div className="stat-top"><span>{weekStat.label}</span><span className={`stat-icon ${weekStat.tone}`}><CalendarDays size={19} /></span></div><div className="stat-value">{weekStat.value}{weekStat.unit && <span>{weekStat.unit}</span>}</div><div className="stat-foot"><span>{weekStat.sub}</span><ChevronRight size={14} /></div></button>
      <WorkHoursCard {...workHours} />
      <RedPacketCard displayMs={workHours.displayMs} month={workHours.month} />
      <button className="stat-card glass" onClick={() => go(allowanceStat.path)}><div className="stat-top"><span>{allowanceStat.label}</span><span className={`stat-icon ${allowanceStat.tone}`}><Wallet size={19} /></span></div><div className="stat-value">{allowanceStat.value}{allowanceStat.unit && <span>{allowanceStat.unit}</span>}</div><div className="stat-foot"><span>{allowanceStat.sub}</span><ChevronRight size={14} /></div></button>
    </div>
    {/* Same 5-column grid as the KPI cards: 待办 / 今日课程 span cards 1–4, 快捷操作 / note sit under card 5. */}
    <div className="dashboard-grid">
      <div className="dg-todo"><TodoHomeCard /></div>
      <section className="glass panel quick-panel dg-quick"><SectionTitle title="快捷操作" /><div className="quick-grid">{[{ label: '记录课时', icon: Clock, path: 'lessons?new' }, { label: '课情反馈', icon: MessageSquare, path: 'lesson-feedback?new' }, { label: '新增学生', icon: Plus, path: 'students/new' }, { label: '上传资料', icon: FileText, path: 'resources/upload' }].map(x => <button key={x.label} onClick={() => go(x.path)}><span><x.icon size={20} /></span>{x.label}</button>)}</div></section>
      <section className="glass panel schedule-panel dg-schedule"><SectionTitle title="今日课程" action="日历" onClick={() => go('courses')} /><div className="mini-date"><span>{now.getMonth() + 1} 月</span>{week.map((d, i) => <button key={d} className={d === today ? 'selected' : ''} onClick={() => go(`courses?date=${d}`)}><small>{weekdays[i]}</small>{Number(d.slice(-2))}</button>)}</div>
        <div className="today-courses">{todays.map((o, i) => { const c = o.course; return <button key={o.key} className={`today-course line-${i % 3}`} onClick={() => go(`courses/${c.id}`)}><small><Clock size={13} />{o.start && o.end ? `${o.start}–${o.end}` : c.time}{c.code && <Badge tone="violet">{c.code}</Badge>}<Badge tone="neutral">{c.status}</Badge></small><strong>{c.name}</strong><p>{teams.find(t => t.id === c.team)?.name || '—'} <span>·</span> {c.teacher}{o.location && <><span>·</span> {o.location}</>}</p></button>; })}{!todays.length && <p className="muted today-empty">今天暂无课程安排</p>}</div>
        <button className="full-link" onClick={() => go('courses')}>查看完整课程安排 <ChevronRight size={15} /></button></section>
    </div>
    <footer className="page-footer"><span>B.E.S.T <i>·</i> Innovation, connected.</span><span><span className="live-dot" /> {s.apiMode ? '工作空间 · 数据实时同步' : '预览站 · 数据保存在本浏览器'}</span></footer>
  </>;
}

/** 教师端首页：本人课程、本周课表、课情反馈入口（金属灰壳）。 */
export function TeacherHome() {
  const s = useNexus(), me = useMe();
  const today = todayIso(), week = weekOf(today);
  const name = me.name || s.user?.name || '';
  const scope = teacherRosterScope(name, { opsCourses: s.opsCourses, courses: s.courses, teams: s.teams, enrollments: s.enrollments, students: s.students });
  // Prefer 课程安排 (courses + sessions); fall back to 课程编号 (opsCourses) when schedule is empty.
  const mine = scope.courses;
  const myOps = scope.opsCourses;
  const occ = occurrences(mine, s.courseSessions);
  const todays = onDate(occ, today);
  const thisWeek = inWeek(occ, today);
  const now = new Date(today + 'T12:00:00');
  const fb = s.lessonFeedbacks.filter(f => scope.opsCourseIds.has(f.course)).slice(0, 5);
  const courseCount = mine.length || myOps.length;
  const teamCount = scope.teamIds.size;
  const studentCount = scope.studentIds.size;
  return <>
    <div className="welcome teacher-welcome"><div><div className="eyebrow">TEACHER WORKSPACE</div><h1>{greeting()}，{name || '老师'} <span className="hello-spark">✧</span></h1><p>仅显示你负责的队伍、课程与学生。</p></div>
      <WorkbenchWelcomeTools now={now} subtitle="授课老师工作台 · 金属灰" /></div>
    <div className="stats-grid teacher-stats">
      {[{ label: '我的课程', value: courseCount, unit: '门', path: 'courses' },
        { label: '我的队伍', value: teamCount, unit: '支', path: 'teams' },
        { label: '我的学生', value: studentCount, unit: '位', path: 'students' },
        { label: '本周课次', value: thisWeek.length, unit: '节', path: 'courses' },
        { label: '今日课程', value: todays.length, unit: '节', path: 'courses' },
        { label: '近期反馈', value: fb.length, unit: '条', path: 'lesson-feedback' }].map(x =>
        <button key={x.label} className="glass stat-card" onClick={() => s.go(x.path)}><div className="stat-top"><span>{x.label}</span></div><div className="stat-value">{x.value}<span>{x.unit}</span></div><div className="stat-foot">查看详情<ChevronRight size={13} /></div></button>)}
    </div>
    <div className="detail-grid">
      <section className="glass panel"><SectionTitle title={mine.length ? '今日课表' : '我的授课课程'} action="全部课程" onClick={() => s.go('courses')} />
        {mine.length ? <>
          <div className="mini-date"><span>{now.getMonth() + 1} 月</span>{week.map((d, i) => <button key={d} className={d === today ? 'selected' : ''} onClick={() => s.go(`courses?date=${d}`)}><small>{weekdays[i]}</small>{Number(d.slice(-2))}</button>)}</div>
          {todays.map(o => <button key={o.key} className="course-row" onClick={() => s.go('courses/' + o.course.id)}><span className="course-time">{o.start || o.course.time.split('–')[0]}<small>{o.date.slice(5)}</small></span><div><h3>{o.course.name}</h3><p>{o.course.teacher}{o.location ? ' · ' + o.location : ''}</p></div><ChevronRight size={17} /></button>)}
          {!todays.length && <p className="muted">今天暂无你的课程</p>}
        </> : <>
          {myOps.slice(0, 8).map(c => <button key={c.id} className="course-row" onClick={() => s.go('lesson-feedback')}><span className="course-time"><small>{c.status}</small>{(c.code || '').slice(-6) || '—'}</span><div><h3>{c.name}</h3><p>{c.code}{c.startDate ? ` · ${c.startDate}` : ''}{c.endDate ? `–${c.endDate}` : ''}</p></div><ChevronRight size={17} /></button>)}
          {!myOps.length && <p className="muted">暂未分配给你的授课课程；运营老师在系统管理中指定授课老师后会出现在这里。</p>}
          {myOps.length > 8 && <button className="full-link" onClick={() => s.go('courses')}>查看全部 {myOps.length} 门课程 <ChevronRight size={15} /></button>}
        </>}
      </section>
      <section className="glass panel"><SectionTitle title="学情反馈" action="课情反馈" onClick={() => s.go('lesson-feedback')} />
        {fb.map(f => { const c = s.opsCourses.find(x => x.id === f.course); return <article key={f.id} className="feedback-card"><small>{f.date} · {c?.code}</small><h3>{c?.name || '课程'}</h3><p>{f.content || f.performance || '（无内容）'}</p></article>; })}
        {!fb.length && <p className="muted">暂无关联到你授课课程的反馈；可在课情反馈中查看或补充。</p>}
        <div className="actions" style={{ marginTop: 12 }}><button className="secondary" onClick={() => s.go('lesson-feedback?new')}><MessageSquare size={16} />写学情反馈</button></div>
      </section>
    </div>
    <footer className="page-footer"><span>B.E.S.T · 授课老师工作空间</span><span>{s.apiMode ? '实时数据' : '预览站'}</span></footer>
  </>;
}
