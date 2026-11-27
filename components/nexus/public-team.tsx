'use client';

import { useEffect, useState } from 'react';
import { ApiError, publicApi, type PublicTeam } from '@/lib/nexus/api';

export default function PublicTeamPage({ id }: { id: string }) {
  const [team, setTeam] = useState<PublicTeam>();
  const [message, setMessage] = useState('正在加载队伍介绍…');
  useEffect(() => {
    const controller = new AbortController();
    publicApi.team(id, controller.signal).then(data => {
      if (!controller.signal.aborted) setTeam(data);
    }).catch(error => {
      if (controller.signal.aborted) return;
      setMessage(error instanceof ApiError && error.status === 404
        ? '该队伍展示页已失效。' : '暂时无法加载队伍介绍，请稍后刷新重试。');
    });
    return () => controller.abort();
  }, [id]);

  return <main className="team-showcase">
    {!team ? <p role="status">{message}</p> : <>
      <header className="team-showcase-header">
        <p>{team.year} 年 · {team.program}</p>
        <h1>{team.name}</h1>
      </header>
      <section className="team-showcase-panel">
        <h2>课题简介</h2>
        <p className="team-showcase-intro">{team.intro || '课题简介待补充。'}</p>
      </section>
      <section className="team-showcase-panel">
        <h2>队伍情况</h2>
        <dl>
          <div><dt>招募状态</dt><dd>{team.recruitStatus}</dd></div>
          {team.stage && <div><dt>项目阶段</dt><dd>{team.stage}</dd></div>}
          {team.capacity !== null && <div><dt>计划名额</dt><dd>{team.capacity} 人</dd></div>}
        </dl>
      </section>
    </>}
  </main>;
}
