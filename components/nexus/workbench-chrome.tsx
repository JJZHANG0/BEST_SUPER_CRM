'use client';
/**
 * Workbench welcome chrome: weather preview (left) + clickable calendar date (right).
 * Calendar opens a centered month/year modal; weather opens a 7-day forecast modal.
 */
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CloudSun, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { useNexus } from '@/lib/nexus/store';
import { api, API_ENABLED } from '@/lib/nexus/api';
import { DEFAULT_WEATHER_CITY, weatherGlyph, weatherLabel, type WeatherPayload } from '@/lib/nexus/weather';
import { zhCN } from 'date-fns/locale';

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const monthsZh = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

function subtitleFor(d: Date, custom?: string) {
  if (custom) return custom;
  return `星期${weekdays[(d.getDay() + 6) % 7]} · 新的一天，新的可能`;
}

export function WorkbenchWelcomeTools({ now, subtitle }: { now: Date; subtitle?: string }) {
  const s = useNexus();
  const city = s.user?.weatherCity || DEFAULT_WEATHER_CITY;
  const [calOpen, setCalOpen] = useState(false);
  const [calMode, setCalMode] = useState<'month' | 'year'>('month');
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [wxOpen, setWxOpen] = useState(false);
  const [wx, setWx] = useState<WeatherPayload | null>(null);
  const [wxErr, setWxErr] = useState<string | null>(null);
  const [wxLoading, setWxLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setWxLoading(true); setWxErr(null);
      try {
        const data = API_ENABLED
          ? await api.weather(city)
          : await fetchOpenMeteoClient(city);
        if (!cancelled) setWx(data);
      } catch {
        if (!cancelled) setWxErr('天气暂不可用');
      } finally {
        if (!cancelled) setWxLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [city]);

  const preview = useMemo(() => {
    if (wx) return { glyph: weatherGlyph(wx.current.code), temp: Math.round(wx.current.temp), label: wx.current.label, place: wx.resolved || wx.city };
    return { glyph: '🌡️', temp: null as number | null, label: wxLoading ? '加载中…' : (wxErr || '天气'), place: city };
  }, [wx, wxLoading, wxErr, city]);

  return (
    <div className="welcome-tools">
      <button type="button" className="welcome-weather" aria-label={`${preview.place}天气`} onClick={() => setWxOpen(true)}>
        <span className="wx-glyph" aria-hidden>{preview.glyph}</span>
        <span className="wx-text">
          <strong>{preview.temp != null ? `${preview.temp}°` : '—'}</strong>
          <small><MapPin size={11} />{preview.place} · {preview.label}</small>
        </span>
        <CloudSun size={16} className="wx-hint" aria-hidden />
      </button>
      <button type="button" className="welcome-date" aria-label="打开日历" onClick={() => { setCalMode('month'); setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); setCalOpen(true); }}>
        <CalendarDays size={17} />
        <div>{now.getFullYear()} 年 {now.getMonth() + 1} 月 {now.getDate()} 日<span>{subtitleFor(now, subtitle)}</span></div>
      </button>

      <Dialog open={calOpen} onOpenChange={setCalOpen}>
        <DialogContent className="calendar-modal">
          <DialogHeader>
            <DialogTitle>日历</DialogTitle>
            <DialogDescription>月视图与年视图可切换浏览。</DialogDescription>
          </DialogHeader>
          <div className="cal-mode-toggle" role="tablist" aria-label="日历视图">
            <button type="button" role="tab" aria-selected={calMode === 'month'} className={calMode === 'month' ? 'on' : ''} onClick={() => setCalMode('month')}>月视图</button>
            <button type="button" role="tab" aria-selected={calMode === 'year'} className={calMode === 'year' ? 'on' : ''} onClick={() => setCalMode('year')}>年视图</button>
          </div>
          {calMode === 'month' ? (
            <div className="cal-month-wrap">
              <Calendar
                mode="single"
                locale={zhCN}
                month={cursor}
                onMonthChange={setCursor}
                selected={now}
                className="cal-rdp"
              />
            </div>
          ) : (
            <div className="cal-year-wrap">
              <div className="cal-year-nav">
                <button type="button" className="icon-button" aria-label="上一年" onClick={() => setCursor(d => new Date(d.getFullYear() - 1, d.getMonth(), 1))}><ChevronLeft size={18} /></button>
                <strong>{cursor.getFullYear()} 年</strong>
                <button type="button" className="icon-button" aria-label="下一年" onClick={() => setCursor(d => new Date(d.getFullYear() + 1, d.getMonth(), 1))}><ChevronRight size={18} /></button>
              </div>
              <div className="cal-year-grid">
                {monthsZh.map((label, i) => {
                  const active = cursor.getFullYear() === now.getFullYear() && i === now.getMonth();
                  return (
                    <button
                      key={label}
                      type="button"
                      className={'cal-year-cell' + (active ? ' current' : '')}
                      onClick={() => { setCursor(new Date(cursor.getFullYear(), i, 1)); setCalMode('month'); }}
                    >{label}</button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={wxOpen} onOpenChange={setWxOpen}>
        <DialogContent className="weather-modal">
          <DialogHeader>
            <DialogTitle>{(wx?.resolved || city)} · 未来 7 天</DialogTitle>
            <DialogDescription>数据来自 Open-Meteo；城市可在「个人设置」中修改。</DialogDescription>
          </DialogHeader>
          {wxLoading && <p className="muted">正在获取天气…</p>}
          {wxErr && !wx && <p className="error-text">{wxErr}</p>}
          {wx && (
            <>
              <div className="wx-now">
                <span className="wx-glyph lg">{weatherGlyph(wx.current.code)}</span>
                <div>
                  <strong>{Math.round(wx.current.temp)}°</strong>
                  <span>{wx.current.label}</span>
                </div>
              </div>
              <ul className="wx-days">
                {wx.daily.map(d => (
                  <li key={d.date}>
                    <span className="wx-day-date">{formatDay(d.date)}</span>
                    <span className="wx-day-glyph" aria-hidden>{weatherGlyph(d.code)}</span>
                    <span className="wx-day-label">{d.label}</span>
                    <span className="wx-day-temps"><b>{Math.round(d.high)}°</b> / {Math.round(d.low)}°</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDay(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const wd = weekdays[(d.getDay() + 6) % 7];
  return `${d.getMonth() + 1}/${d.getDate()} 周${wd}`;
}

/** Demo / static build: call Open-Meteo directly (CORS allowed). */
async function fetchOpenMeteoClient(city: string): Promise<WeatherPayload> {
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`).then(r => r.json()) as {
    results?: { name: string; latitude: number; longitude: number; admin1?: string; country?: string }[];
  };
  const hit = geo.results?.[0];
  if (!hit) throw new Error('city');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=7`;
  const f = await fetch(url).then(r => r.json()) as {
    current: { temperature_2m: number; weather_code: number };
    daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
  };
  return {
    city,
    resolved: [hit.name, hit.admin1].filter(Boolean).join(' · ') || city,
    latitude: hit.latitude,
    longitude: hit.longitude,
    current: { temp: f.current.temperature_2m, code: f.current.weather_code, label: weatherLabel(f.current.weather_code) },
    daily: f.daily.time.map((date, i) => ({
      date,
      code: f.daily.weather_code[i],
      label: weatherLabel(f.daily.weather_code[i]),
      high: f.daily.temperature_2m_max[i],
      low: f.daily.temperature_2m_min[i],
    })),
  };
}
