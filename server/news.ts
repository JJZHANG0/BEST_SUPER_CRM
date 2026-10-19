/**
 * Aggregate a few public RSS feeds into a title-only 「当日新闻」 list.
 * Cached in-process for 45 minutes so the workbench never waits on upstream.
 */
export type NewsItem = { title: string; source: string };

const FEEDS: { source: string; url: string }[] = [
  { source: '人民网', url: 'http://www.people.com.cn/rss/politics.xml' },
  { source: '新华网', url: 'http://www.news.cn/politics/news_politics.xml' },
  { source: '36氪', url: 'https://36kr.com/feed' },
  { source: 'IT之家', url: 'https://www.ithome.com/rss/' },
];

const CACHE_MS = 45 * 60_000;
type Cache = { at: number; items: NewsItem[] };
let cache: Cache | null = null;
let inflight: Promise<NewsItem[]> | null = null;

const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function parseRss(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(b);
    const title = m ? decode(m[1]) : '';
    if (title && title.length >= 4) items.push({ title: title.slice(0, 120), source });
  }
  return items;
}

async function fetchFeed(feed: { source: string; url: string }): Promise<NewsItem[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'BEST-NEXUS-news/1.0 (+https://bestcrm.cc)', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    });
    if (!res.ok) return [];
    return parseRss(await res.text(), feed.source).slice(0, 8);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function load(): Promise<NewsItem[]> {
  const batches = await Promise.all(FEEDS.map(fetchFeed));
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  const queues = batches.map(b => [...b]);
  while (out.length < 12) {
    let added = false;
    for (const q of queues) {
      while (q.length) {
        const item = q.shift()!;
        const key = item.title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
        added = true;
        break;
      }
      if (out.length >= 12) break;
    }
    if (!added) break;
  }
  return out;
}

/** Return cached headlines; refresh in the background when stale. Never throws. */
export async function todayNews(): Promise<{ items: NewsItem[]; updatedAt: string | null; stale: boolean }> {
  const now = Date.now();
  const hit = cache;
  if (hit && now - hit.at < CACHE_MS) {
    return { items: hit.items, updatedAt: new Date(hit.at).toISOString(), stale: false };
  }
  if (!inflight) {
    inflight = load().then(items => {
      cache = { at: Date.now(), items };
      return items;
    }).finally(() => { inflight = null; });
  }
  if (hit) {
    void inflight;
    return { items: hit.items, updatedAt: new Date(hit.at).toISOString(), stale: true };
  }
  try {
    const items = await inflight;
    const fresh: Cache | null = cache;
    return { items, updatedAt: fresh ? new Date(fresh.at).toISOString() : null, stale: false };
  } catch {
    return { items: [], updatedAt: null, stale: false };
  }
}
