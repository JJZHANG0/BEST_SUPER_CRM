'use client';
/**
 * Workbench KPI card: 本月累计工时 — digital clock that accumulates while the user
 * is on the dashboard with the tab visible. Persists to the API (or localStorage in demo).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Timer, ChevronRight } from 'lucide-react';
import { useNexus } from '@/lib/nexus/store';
import { api, API_ENABLED } from '@/lib/nexus/api';
import { monthLabel } from '@/lib/nexus/ops';

const DEMO_KEY = 'nexus.demo.work-hours.v1';

function shanghaiMonth(d = new Date()) {
  // Asia/Shanghai is UTC+8 year-round (no DST).
  const sh = new Date(d.getTime() + 8 * 3600_000);
  const y = sh.getUTCFullYear();
  const m = String(sh.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function readDemo(month: string, email: string): number {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, number>;
    return map[`${email}:${month}`] || 0;
  } catch { return 0; }
}

function writeDemo(month: string, email: string, totalMs: number) {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, number>;
    map[`${email}:${month}`] = totalMs;
    localStorage.setItem(DEMO_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function WorkHoursCard() {
  const s = useNexus();
  const month = shanghaiMonth();
  const [displayMs, setDisplayMs] = useState(0);
  const [running, setRunning] = useState(false);
  const sessionStart = useRef<number | null>(null);
  const pendingMs = useRef(0); // unsent session elapsed since last successful flush
  const baseRef = useRef(0);
  const flushing = useRef(false);
  const email = s.user?.email || 'local';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (API_ENABLED) {
        try {
          const r = await api.workHours(month);
          if (!cancelled) { baseRef.current = r.totalMs; setDisplayMs(r.totalMs); pendingMs.current = 0; }
        } catch { /* keep 0 */ }
      } else {
        const ms = readDemo(month, email);
        if (!cancelled) { baseRef.current = ms; setDisplayMs(ms); pendingMs.current = 0; }
      }
    })();
    return () => { cancelled = true; };
  }, [month, email]);

  /** Persist accrued session time. `restart` keeps counting after a mid-session save. */
  const flush = useCallback(async (restart: boolean) => {
    if (sessionStart.current == null || flushing.current) return;
    const elapsed = Date.now() - sessionStart.current;
    const delta = elapsed - pendingMs.current;
    if (delta < 500 && restart) return; // skip tiny mid-session saves
    if (delta <= 0) {
      if (!restart) { sessionStart.current = null; pendingMs.current = 0; }
      return;
    }
    flushing.current = true;
    pendingMs.current = elapsed;
    try {
      if (API_ENABLED) {
        const r = await api.reportWorkHours(month, delta);
        baseRef.current = r.totalMs;
        setDisplayMs(r.totalMs + (restart && sessionStart.current != null ? 0 : 0));
        if (restart) {
          sessionStart.current = Date.now();
          pendingMs.current = 0;
        } else {
          sessionStart.current = null;
          pendingMs.current = 0;
          setDisplayMs(r.totalMs);
        }
      } else {
        const next = baseRef.current + delta;
        baseRef.current = next;
        writeDemo(month, email, next);
        if (restart) {
          sessionStart.current = Date.now();
          pendingMs.current = 0;
          setDisplayMs(next);
        } else {
          sessionStart.current = null;
          pendingMs.current = 0;
          setDisplayMs(next);
        }
      }
    } catch {
      // keep pending; next flush retries
      pendingMs.current = Math.max(0, pendingMs.current - delta);
    } finally {
      flushing.current = false;
    }
  }, [month, email]);

  // Start / stop based on route + tab visibility.
  useEffect(() => {
    const page = () => s.route.split(/[/?]/)[0];
    const shouldRun = () => page() === 'dashboard' && document.visibilityState === 'visible' && !!s.authenticated;

    const start = () => {
      if (sessionStart.current != null) return;
      sessionStart.current = Date.now();
      pendingMs.current = 0;
      setRunning(true);
    };
    const stop = () => {
      if (sessionStart.current == null) return;
      setRunning(false);
      void flush(false);
    };

    if (shouldRun()) start(); else stop();

    const onVis = () => { if (shouldRun()) start(); else stop(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (sessionStart.current != null) void flush(false);
    };
  }, [s.route, s.authenticated, flush]);

  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => {
      if (sessionStart.current == null) return;
      setDisplayMs(baseRef.current + (Date.now() - sessionStart.current));
    }, 250);
    const save = window.setInterval(() => { void flush(true); }, 15_000);
    return () => { clearInterval(tick); clearInterval(save); };
  }, [running, flush]);

  const hours = Math.floor(displayMs / 3_600_000);
  const sub = running
    ? `${monthLabel(month)} · 计时中`
    : `${monthLabel(month)} · 离开工作台已暂停`;

  return (
    <div className="stat-card glass work-hours-card" role="status" aria-live="polite" aria-label="本月累计工时">
      <div className="stat-top">
        <span>本月累计工时</span>
        <span className={`stat-icon blue${running ? ' live' : ''}`}><Timer size={19} /></span>
      </div>
      <div className="stat-value work-hours-clock">
        <span className="wh-digits">{formatClock(displayMs)}</span>
      </div>
      <div className="stat-foot">
        <span>{sub}{hours > 0 ? ` · 约 ${hours} 小时` : ''}</span>
        <ChevronRight size={14} className="opacity-0" aria-hidden />
      </div>
    </div>
  );
}
