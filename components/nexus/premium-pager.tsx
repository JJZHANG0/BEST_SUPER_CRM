'use client';
/**
 * Premium student-list pager: prev/next, page-size, total, ellipsis, current highlight, subtle motion.
 */
import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SIZES = [10, 20, 50] as const;

function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach(n => set.add(n));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach(n => set.add(n));
  const sorted = [...set].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) out.push('…');
    out.push(sorted[i]!);
  }
  return out;
}

export function PremiumPager({
  page, pageSize, total, onPage, onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safe = Math.min(Math.max(1, page), pages);
  const window = useMemo(() => pageWindow(safe, pages), [safe, pages]);
  const from = total === 0 ? 0 : (safe - 1) * pageSize + 1;
  const to = Math.min(safe * pageSize, total);

  return (
    <nav className="premium-pager" aria-label="学生列表分页">
      <div className="premium-pager-meta">
        <span>共 <b>{total}</b> 位 · 显示 {from}–{to}</span>
        <label className="premium-pager-size">
          每页
          <select
            aria-label="每页条数"
            value={pageSize}
            onChange={e => onPageSize(Number(e.target.value))}
          >
            {SIZES.map(n => <option key={n} value={n}>{n} 条</option>)}
          </select>
        </label>
      </div>
      <div className="premium-pager-controls">
        <button
          type="button"
          className="premium-pager-nav"
          aria-label="上一页"
          disabled={safe <= 1}
          onClick={() => onPage(safe - 1)}
        >
          <ChevronLeft size={16} /><span>上一页</span>
        </button>
        <ul className="premium-pager-pages">
          {window.map((item, i) => item === '…'
            ? <li key={`e${i}`} className="premium-pager-ellipsis" aria-hidden>…</li>
            : <li key={item}>
                <button
                  type="button"
                  className={'premium-pager-page' + (item === safe ? ' active' : '')}
                  aria-label={`第 ${item} 页`}
                  aria-current={item === safe ? 'page' : undefined}
                  onClick={() => onPage(item)}
                >{item}</button>
              </li>)}
        </ul>
        <button
          type="button"
          className="premium-pager-nav"
          aria-label="下一页"
          disabled={safe >= pages}
          onClick={() => onPage(safe + 1)}
        >
          <span>下一页</span><ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
