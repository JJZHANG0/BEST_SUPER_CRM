'use client';
/**
 * 工作台「当日新闻」: titles only, no links.
 * Height matches the left 待办 card (ResizeObserver); list scrolls inside so the page does not grow.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, API_ENABLED } from '@/lib/nexus/api';
import { SectionTitle } from './ui';

type Item = { title: string; source: string; category?: string };

export function NewsPanel() {
  const panelRef = useRef<HTMLElement>(null);
  const [items, setItems] = useState<Item[] | null>(API_ENABLED ? null : []);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!API_ENABLED) return;
    let alive = true;
    api.newsToday().then(r => { if (alive) setItems(r.items || []); }).catch(() => { if (alive) { setFailed(true); setItems([]); } });
    return () => { alive = false; };
  }, []);
  // Match the left 待办 card height; news list scrolls inside.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const grid = panel.closest('.dashboard-grid');
    const todo = grid?.querySelector('.dg-todo .todo-home-panel, .dg-todo') as HTMLElement | null;
    if (!todo || typeof ResizeObserver === 'undefined') return;
    const apply = () => {
      const h = Math.round(todo.getBoundingClientRect().height);
      if (h > 80) panel.style.height = h + 'px';
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(todo);
    window.addEventListener('resize', apply);
    return () => { ro.disconnect(); window.removeEventListener('resize', apply); panel.style.height = ''; };
  }, [items]);
  return (
    <section ref={panelRef} className="glass panel news-panel dg-quick">
      <SectionTitle title="当日新闻" sub="时政 · 科技 · 娱乐 · 仅供浏览" />
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
