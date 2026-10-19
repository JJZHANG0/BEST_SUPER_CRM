'use client';
/**
 * 队伍管理 · dense expandable list (replaces the card grid).
 * Row: name · project logo/short · 招募状态 · 名额 · 负责人 · members · status.
 * Expand inline for progress / notes / poster / member preview; 「进入队伍」 opens the existing detail page.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, Users, UserRound, ArrowRight } from 'lucide-react';
import { useNexus, useVisible } from '@/lib/nexus/store';
import { stages, type Team } from '@/lib/nexus/data';
import { teamEnrolled, normalizeRecruitStatus, inactiveEnrollment } from '@/lib/nexus/sales';
import { Badge, SearchBox, Choice, NoResults, StageBar, PageTitle, EmptyState } from './ui';
import { CompetitionLogo } from './competition-logo';

function seatLabel(t: Team, live: number) {
  const enrolled = teamEnrolled(live, t.recruitEnrolled);
  if (t.recruitCapacity != null) return `${enrolled}/${t.recruitCapacity}`;
  return enrolled ? `${enrolled} 人` : '名额待定';
}

function TeamRow({ team, open, onToggle }: { team: Team; open: boolean; onToggle: () => void }) {
  const s = useNexus();
  const program = s.programs.find(p => p.id === team.program);
  const members = s.enrollments.filter(e => e.team === team.id && !inactiveEnrollment(e.status));
  const live = new Set(members.map(e => e.student)).size;
  const enrolled = teamEnrolled(live, team.recruitEnrolled);
  const recruit = normalizeRecruitStatus(team.recruitStatus);
  const preview = members.slice(0, 5).map(e => s.students.find(x => x.id === e.student)).filter(Boolean);
  return (
    <li className={'team-row glass' + (open ? ' is-open' : '')}>
      <button type="button" className="team-row-main" onClick={onToggle} aria-expanded={open}>
        <span className="team-row-name">{team.name}</span>
        <span className="team-row-spacer" aria-hidden="true" />
        <span className="team-row-meta">
          {program && <span className="team-row-prog"><CompetitionLogo program={program} size={22} /><em>{program.short}</em></span>}
          {recruit && <Badge tone={/满|结束/.test(recruit) ? 'neutral' : recruit.includes('火热') ? 'pink' : 'green'}>{recruit}</Badge>}
          <span className="team-row-stat" title="已招 / 名额">{seatLabel(team, live)}</span>
          <span className="team-row-stat muted" title="负责人"><UserRound size={13} />{team.opsOwner || team.teacher || '—'}</span>
          <span className="team-row-stat muted" title="成员数"><Users size={13} />{live}</span>
          <Badge tone={team.status === '正常进行' ? 'green' : 'orange'}>{team.status}</Badge>
        </span>
        <ChevronDown size={18} className={'team-row-chev' + (open ? ' open' : '')} aria-hidden="true" />
      </button>
      {open && (
        <div className="team-row-detail">
          <div className="team-row-detail-grid">
            <div>
              <h4>项目与阶段</h4>
              <p>{program?.name || team.program}{team.stage > 0 ? ` · ${stages[team.stage - 1]}（${String(team.stage).padStart(2, '0')} / 05）` : ' · 阶段未设定'}</p>
              {team.stage > 0 && <StageBar stage={team.stage} />}
              {team.progress?.summary && <p className="muted">{team.progress.summary}</p>}
            </div>
            <div>
              <h4>招募</h4>
              <p>状态 {recruit || '未设定'} · 名额 {team.recruitCapacity ?? '待定'} · 已招 {enrolled}{team.recruitCapacity != null ? ` · 剩余 ${Math.max(0, team.recruitCapacity - enrolled)}` : ''}</p>
              <p className="muted">指导老师 {team.teacher || '—'} · 负责人 {team.opsOwner || '—'}</p>
              {team.note && <p className="muted">{team.note}</p>}
            </div>
            <div>
              <h4>成员预览 · {live}</h4>
              {preview.length ? <ul className="team-row-members">{preview.map(x => x && <li key={x.id}><span className="avatar tiny">{x.name.slice(0, 1)}</span>{x.name}<small>{x.grade}</small></li>)}</ul> : <p className="muted">暂无成员</p>}
              {live > preview.length && <p className="muted">另有 {live - preview.length} 位…</p>}
            </div>
            {team.posterUrl && <div className="team-row-poster"><h4>课题海报</h4><img src={team.posterUrl} alt="" loading="lazy" /></div>}
          </div>
          <div className="team-row-actions">
            <button type="button" className="primary compact" onClick={() => s.go('teams/' + team.id)}>进入队伍 <ArrowRight size={15} /></button>
          </div>
        </div>
      )}
    </li>
  );
}

export function Teams() {
  const s = useNexus(), v = useVisible();
  const [q, setQ] = useState(''), [filter, setFilter] = useState(s.route.includes('attention') ? '需要关注' : '全部队伍'), [program, setProgram] = useState(''), [openId, setOpenId] = useState<string | null>(null);
  const programChips = useMemo(() => s.programs.map(p => ({ id: p.id, name: p.name, short: p.short, color: p.color, count: v.teams.filter(t => t.program === p.id).length })).filter(p => p.count > 0), [s.programs, v.teams]);
  const list = v.teams.filter(t => (t.name + (s.programs.find(p => p.id === t.program)?.name || '')).includes(q) && (!program || t.program === program) && (filter === '全部队伍' || (filter === '需要关注' ? t.status !== '正常进行' : t.status === '正常进行')));
  return <>
    <PageTitle title="队伍管理" en="TEAM MANAGEMENT" description="协同每一支队伍，让想法走向成果。" action={s.role !== 'sales' ? '新建队伍' : undefined} onAction={() => s.go('teams/new')} />
    <div className="filter-toolbar"><SearchBox value={q} onChange={setQ} placeholder="搜索队伍或项目" /><Choice value={filter} onChange={setFilter} options={['全部队伍', '需要关注', '正常进行']} label="队伍状态" /></div>
    {programChips.length > 0 && <div className="filter-chips team-program-chips" role="group" aria-label="按项目筛选队伍">
      <button type="button" className={!program ? 'selected' : ''} aria-pressed={!program} onClick={() => setProgram('')}>全部<em>{v.teams.length}</em></button>
      {programChips.map(p => <button type="button" key={p.id} className={program === p.id ? 'selected' : ''} aria-pressed={program === p.id} onClick={() => setProgram(x => x === p.id ? '' : p.id)}>
        <CompetitionLogo program={p} size={18} /><span>{p.short}</span><em>{p.count}</em>
      </button>)}
    </div>}
    <div className="results-meta">共 {list.length} 支队伍</div>
    {list.length ? <ul className="team-list">{list.map(t => <TeamRow key={t.id} team={t} open={openId === t.id} onToggle={() => setOpenId(x => x === t.id ? null : t.id)} />)}</ul>
      : (v.teams.length ? <NoResults /> : <EmptyState icon={Users} title="还没有队伍" description="新建队伍并关联项目，之后可为学生分配队伍、跟进阶段进度。" action={s.role !== 'sales' ? '新建队伍' : undefined} onAction={() => s.go('teams/new')} />)}
  </>;
}
