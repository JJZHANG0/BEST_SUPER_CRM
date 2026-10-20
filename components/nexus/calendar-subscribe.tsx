'use client';
/**
 * 「课表日历订阅」 on 个人设置: copy HTTPS URL + open webcal:// for Apple Calendar.
 * Feed is unauthenticated (secret token); CRM remains the source of truth.
 */
import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Copy, ExternalLink, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, API_ENABLED } from '@/lib/nexus/api';
import { copyText } from '@/lib/nexus/clipboard';
import { useNexus } from '@/lib/nexus/store';

type Sub = { token: string; httpsUrl: string; webcalUrl: string; path: string };

export function CalendarSubscribeBlock() {
  const s = useNexus();
  const [sub, setSub] = useState<Sub | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const sales = s.role === 'sales';

  const load = useCallback(async () => {
    if (!API_ENABLED || sales) return;
    setLoading(true);
    try {
      const r = await api.calendarSubscription();
      setSub(r);
    } catch (e) {
      const msg = e instanceof ApiError ? (e.message || e.code) : '加载订阅链接失败';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [sales]);

  useEffect(() => { void load(); }, [load]);

  if (sales) return null;

  if (!API_ENABLED) {
    return (
      <section className="glass panel settings-section">
        <h3><span className="settings-section-title"><CalendarDays size={16}/>课表日历订阅</span></h3>
        <p className="settings-theme-hint">在线版 CRM（bestcrm.cc）登录后可生成私人订阅链接，粘贴到苹果日历后自动同步排课变更。当前为预览站，不提供订阅。</p>
      </section>
    );
  }

  const copyHttps = async () => {
    if (!sub) return;
    if (await copyText(sub.httpsUrl)) toast.success('订阅链接已复制');
    else toast.error('浏览器限制了复制，请手动选择链接');
  };

  const regenerate = async () => {
    if (!sub || busy) return;
    if (!window.confirm('重新生成后，旧的订阅链接会立即失效。已添加到苹果日历的需要重新订阅。确定继续？')) return;
    setBusy(true);
    try {
      const r = await api.regenerateCalendarSubscription();
      setSub(r);
      toast.success('已生成新链接，请重新添加到日历');
    } catch (e) {
      toast.error(e instanceof ApiError ? (e.message || e.code) : '重新生成失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass panel settings-section calendar-subscribe">
      <h3><span className="settings-section-title"><CalendarDays size={16}/>课表日历订阅</span></h3>
      <p className="settings-theme-hint">
        生成私人只读链接，粘贴到 iPhone / iPad / Mac 的「日历」App 后，你作为授课老师或运营老师的课程会自动出现；CRM 改排课后苹果会周期性刷新。无需企业微信，也无需 Apple 开发者账号。
      </p>
      {loading && !sub ? <p className="muted">正在生成订阅链接…</p> : null}
      {sub ? (
        <>
          <div className="public-link-row cal-sub-link">
            <input readOnly value={sub.httpsUrl} aria-label="日历订阅 HTTPS 链接" onFocus={e => e.target.select()} />
            <button type="button" className="icon-button" aria-label="复制订阅链接" onClick={() => void copyHttps()}><Copy size={16}/></button>
          </div>
          <div className="cal-sub-actions">
            <button type="button" className="secondary compact" onClick={() => void copyHttps()}><Copy size={15}/>复制 HTTPS 链接</button>
            <a className="primary compact cal-sub-webcal" href={sub.webcalUrl}><ExternalLink size={15}/>在苹果日历中打开</a>
            <button type="button" className="text-button" disabled={busy} onClick={() => void regenerate()}><RefreshCw size={14}/>{busy ? '生成中…' : '重新生成链接'}</button>
          </div>
          <ol className="cal-sub-steps">
            <li><Smartphone size={14}/>iPhone / iPad：设置 → 日历 → 账户 → 添加账户 → 其他 → 添加已订阅的日历，粘贴上面的链接。</li>
            <li>Mac：打开「日历」→ 文件 → 新建日历订阅，粘贴链接；或点「在苹果日历中打开」。</li>
            <li>链接含私人密钥，请勿转发；泄露时点「重新生成链接」即可作废旧地址。</li>
          </ol>
        </>
      ) : null}
    </section>
  );
}
