'use client';
/** 工作台「当日新闻」: titles only, no links. Fetched from /api/news/today (cached server-side). */
import { useEffect, useState } from 'react';
import { api, API_ENABLED } from '@/lib/nexus/api';
import { SectionTitle } from './ui';

type Item = { title: string; source: string };

export function NewsPanel() {
  const [items, setItems] = useState<Item[] | null>(API_ENABLED ? null : []);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!API_ENABLED) return;
    let alive = true;
    api.newsToday().then(r => { if (alive) setItems(r.items || []); }).catch(() => { if (alive) { setFailed(true); setItems([]); } });
    return () => { alive = false; };
  }, []);
  return (
    <section className="glass panel news-panel dg-quick">
      <SectionTitle title="当日新闻" sub="热点标题 · 仅供浏览" />
      {items === null && <div className="news-loading" aria-busy="true"><span /><span /><span /></div>}
      {items && items.length > 0 && (
        <ol className="news-list">
          {items.map((x, i) => (
            <li key={i}><span className="news-rank">{String(i + 1).padStart(2, '0')}</span><span className="news-title">{x.title}</span><em className="news-source">{x.source}</em></li>
          ))}
        </ol>
      )}
      {items && !items.length && (
        <p className="muted news-empty">{failed ? '新闻源暂时不可用，稍后再试。' : '今日暂无新闻。'}</p>
      )}
    </section>
  );
}
