'use client';
import { Users, Layers, UsersRound, CalendarDays, Plus, FileText, MessageSquare, Clock, Sparkles, ChevronRight, Wallet } from 'lucide-react';
import { Badge, SectionTitle } from './ui';
import { TodoHomeCard } from './todos';
import { useMonthAllowance } from './ops-pages';
import { greeting } from './recruitment';
import { useNexus, useMe } from '@/lib/nexus/store';
import { money2, monthLabel, today as todayIso } from '@/lib/nexus/ops';
import { type Program, type Student, type Team, type Course, type Role } from '@/lib/nexus/data';

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
  const attention = teams.filter(t => t.status !== '正常进行' && t.status !== '已完成');
  const todays = courses.filter(c => c.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const thisWeek = courses.filter(c => week.includes(c.date));
  const now = new Date(today + 'T12:00:00');
  const stats = [
    { label: '学生总数', value: students.length, unit: '位', icon: Users, sub: students.length ? `${new Set(students.map(x => x.program)).size} 个项目有在读学生` : '暂无学生，点击新增', tone: 'violet', path: students.length ? 'students' : 'students/new' },
    { label: '进行中的项目', value: programs.filter(p => p.published).length, unit: '个', icon: Layers, sub: `项目库共 ${programs.length} 个项目`, tone: 'blue', path: 'programs' },
    { label: '活跃队伍', value: teams.length, unit: '支', icon: UsersRound, sub: teams.length ? `${attention.length} 支队伍需要关注` : '暂无队伍', tone: 'pink', path: 'teams' },
    { label: '本周课程', value: thisWeek.length, unit: '节', icon: CalendarDays, sub: `今天有 ${todays.length} 节课程`, tone: 'green', path: 'courses' },
    { label: '当月教务津贴', value: money2(allowance.amount), unit: '', icon: Wallet, sub: allowance.count ? `${monthLabel(allowance.month)} · ${allowance.hours} 小时 · ${allowance.count} 条` : `${monthLabel(allowance.month)}暂无课时记录`, tone: 'orange', path: 'lessons' },
  ];
  return <>
    <div className="welcome"><div><div className="eyebrow">YOUR INNOVATION WORKSPACE</div><h1>{greeting()}，{me.name || '老师'} <span className="hello-spark">✧</span></h1><p>让每一个创新项目，都被高效推进。</p></div><div className="welcome-date"><CalendarDays size={17} /><div>{now.getFullYear()} 年 {now.getMonth() + 1} 月 {now.getDate()} 日<span>星期{weekdays[(now.getDay() + 6) % 7]} · 新的一天，新的可能</span></div></div></div>
    <div className="stats-grid five">{stats.map(x => <button className="stat-card glass" key={x.label} onClick={() => go(x.path)}><div className="stat-top"><span>{x.label}</span><span className={`stat-icon ${x.tone}`}><x.icon size={19} /></span></div><div className="stat-value">{x.value}{x.unit && <span>{x.unit}</span>}</div><div className="stat-foot"><span>{x.sub}</span><ChevronRight size={14} /></div></button>)}</div>
    {/* Row 1: 待办事项 | 快捷操作 (equal height). Row 2: 今日课程 under 待办 | note. */}
    <div className="dashboard-grid">
      <div className="dg-todo"><TodoHomeCard /></div>
      <section className="glass panel quick-panel dg-quick"><SectionTitle title="快捷操作" /><div className="quick-grid">{[{ label: '记录课时', icon: Clock, path: 'lessons?new' }, { label: '课情反馈', icon: MessageSquare, path: 'lesson-feedback?new' }, { label: '新增学生', icon: Plus, path: 'students/new' }, { label: '上传资料', icon: FileText, path: 'resources/upload' }].map(x => <button key={x.label} onClick={() => go(x.path)}><span><x.icon size={20} /></span>{x.label}</button>)}</div></section>
      <section className="glass panel schedule-panel dg-schedule"><SectionTitle title="今日课程" action="日历" onClick={() => go('courses')} /><div className="mini-date"><span>{now.getMonth() + 1} 月</span>{week.map((d, i) => <button key={d} className={d === today ? 'selected' : ''} onClick={() => go(`courses?date=${d}`)}><small>{weekdays[i]}</small>{Number(d.slice(-2))}</button>)}</div>
        <div className="today-courses">{todays.map((c, i) => <button key={c.id} className={`today-course line-${i % 3}`} onClick={() => go(`courses/${c.id}`)}><small><Clock size={13} />{c.time}<Badge tone="neutral">{c.status}</Badge></small><strong>{c.name}</strong><p>{teams.find(t => t.id === c.team)?.name} <span>·</span> {c.teacher}</p></button>)}{!todays.length && <p className="muted today-empty">今天暂无课程安排</p>}</div>
        <button className="full-link" onClick={() => go('courses')}>查看完整课程安排 <ChevronRight size={15} /></button></section>
      <div className="workspace-note dg-note"><Sparkles size={22} /><div><strong>让创新，发生在每一天。</strong><p>连接学生、老师与每一种可能。</p></div></div>
    </div>
    <footer className="page-footer"><span>PROJECT NEXUS <i>·</i> Innovation, connected.</span><span><span className="live-dot" /> {s.apiMode ? '工作空间 · 数据实时同步' : '预览站 · 数据保存在本浏览器'}</span></footer>
  </>;
}
