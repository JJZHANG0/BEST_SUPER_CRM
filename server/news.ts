/**
 * Aggregate public RSS into a title-only 「当日新闻」 list: 时政 · 科技 · 娱乐.
 * Cached in-process for 45 minutes. Gaming / off-topic tech fluff is filtered out.
 */
export type NewsItem = { title: string; source: string; category: 'politics' | 'tech' | 'entertainment' };

type Feed = { source: string; url: string; category: NewsItem['category'] };

const FEEDS: Feed[] = [
  { category: 'politics', source: '人民网', url: 'http://www.people.com.cn/rss/politics.xml' },
  { category: 'politics', source: '新华网', url: 'http://www.news.cn/politics/news_politics.xml' },
  { category: 'tech', source: 'IT之家', url: 'https://www.ithome.com/rss/' },
  { category: 'tech', source: '极客公园', url: 'https://www.geekpark.net/rss' },
  { category: 'entertainment', source: '人民网娱乐', url: 'http://www.people.com.cn/rss/ent.xml' },
  { category: 'entertainment', source: '新华娱乐', url: 'http://www.news.cn/ent/news_ent.xml' },
];

/** Drop gaming / console / Epic-style fluff from tech feeds. */
const TECH_BLOCK = /游戏|电玩|手游|端游|主机|Steam|Epic|Xbox|PlayStation|任天堂|Switch|DLC|Roguelike|糖豆人|原神|王者荣耀|Steam\s*Deck|独立游戏|发售|通关|联机|开黑|CS2|DOTA|LOL|英雄联盟|PUBG/i;
/** Soft prefer entertainment about stars / film / TV / music. */
const ENT_SOFT = /明星|演员|歌手|导演|影视|电影|电视剧|综艺|演唱会|粉丝|红毯|首映|档期|票房|偶像|艺人|卫视|剧组|选秀|好声音|春晚/;

const CACHE_MS = 45 * 60_000;
type Cache = { at: number; items: NewsItem[] };
let cache: Cache | null = null;
let inflight: Promise<NewsItem[]> | null = null;

const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function parseRss(xml: string, source: string, category: NewsItem['category']): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(b);
    const title = m ? decode(m[1]) : '';
    if (!title || title.length < 4) continue;
    if (category === 'tech' && TECH_BLOCK.test(title)) continue;
    if (category === 'entertainment' && /讣告|讣闻|逝世|悼念/.test(title) && !ENT_SOFT.test(title)) continue;
    items.push({ title: title.slice(0, 120), source, category });
  }
  return items;
}

async function fetchFeed(feed: Feed): Promise<NewsItem[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'BEST-NEXUS-news/1.0 (+https://bestcrm.cc)', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    });
    if (!res.ok) return [];
    return parseRss(await res.text(), feed.source, feed.category).slice(0, 10);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Balanced mix: up to 4 per category, 12 total. Prefer entertainment titles that look celebrity/film related. */
async function load(): Promise<NewsItem[]> {
  const batches = await Promise.all(FEEDS.map(fetchFeed));
  const byCat: Record<NewsItem['category'], NewsItem[]> = { politics: [], tech: [], entertainment: [] };
  const seen = new Set<string>();
  for (const batch of batches) {
    for (const item of batch) {
      const key = item.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      byCat[item.category].push(item);
    }
  }
  // Soft-sort entertainment: celebrity / film first.
  byCat.entertainment.sort((a, b) => Number(ENT_SOFT.test(b.title)) - Number(ENT_SOFT.test(a.title)));
  const out: NewsItem[] = [];
  const cats: NewsItem['category'][] = ['politics', 'tech', 'entertainment'];
  const queues = cats.map(c => byCat[c].slice(0, 6));
  while (out.length < 12) {
    let added = false;
    for (const q of queues) {
      const perCat = out.filter(x => x.category === q[0]?.category).length;
      if (!q.length || perCat >= 4) continue;
      out.push(q.shift()!);
      added = true;
      if (out.length >= 12) break;
    }
    if (!added) {
      // Fill remaining slots from any leftover (still capped at 12).
      for (const q of queues) {
        while (q.length && out.length < 12) out.push(q.shift()!);
      }
      break;
    }
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
