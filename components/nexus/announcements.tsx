'use client';
/**
 * 项目公告: list + compose (ops) + read receipts for the author.
 */
import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Users, CheckCheck, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useNexus } from '@/lib/nexus/store';
import { AUDIENCE_LABELS, ANNOUNCEMENT_AUDIENCES, type Announcement, type AnnouncementAudience, type AnnouncementDirectoryUser, type AnnouncementReadRow } from '@/lib/nexus/announcements';
import { isOpsLike } from '@/lib/nexus/roles';
import { Badge, PageTitle, FormField, Choice, EmptyState, Notice } from './ui';

const AUDIENCE_OPTIONS = ANNOUNCEMENT_AUDIENCES.map(a => AUDIENCE_LABELS[a]);
const labelToAudience = (label: string): AnnouncementAudience =>
  (ANNOUNCEMENT_AUDIENCES.find(a => AUDIENCE_LABELS[a] === label) || 'all');

function ComposeForm({ onDone }: { onDone: () => void }) {
  const s = useNexus();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState('公告');
  const [programName, setProgramName] = useState('不关联项目');
  const [audienceLabel, setAudienceLabel] = useState(AUDIENCE_LABELS.all);
  const [picked, setPicked] = useState<number[]>([]);
  const [directory, setDirectory] = useState<AnnouncementDirectoryUser[]>([]);
  const [busy, setBusy] = useState(false);
  const audience = labelToAudience(audienceLabel);
  const needPick = audience === 'selected' || audience === 'selected_teachers';

  useEffect(() => {
    if (!needPick) return;
    void s.loadAnnouncementDirectory().then(setDirectory);
  }, [needPick, s]);

  const pickable = useMemo(() => {
    if (audience === 'selected_teachers') return directory.filter(u => u.role === 'teacher');
    return directory;
  }, [directory, audience]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('请填写标题');
    if (!body.trim()) return toast.error('请填写正文');
    if (needPick && !picked.length) return toast.error('请至少选择一位留言对象');
    setBusy(true);
    const program = programName === '不关联项目' ? null : s.programs.find(p => p.name === programName)?.id || null;
    const r = await s.createAnnouncement({
      title: title.trim(), body: body.trim(), tag: tag.trim() || '公告', program,
      audience, recipientIds: needPick ? picked : [],
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success('公告已发布');
    onDone();
  };

  return (
    <form className="glass panel form-stack ann-compose" onSubmit={submit}>
      <h2>发布公告留言</h2>
      <FormField label="标题"><input autoFocus required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：本周排课调整说明" /></FormField>
      <FormField label="正文"><textarea required rows={5} maxLength={4000} value={body} onChange={e => setBody(e.target.value)} placeholder="写给留言对象的内容…" /></FormField>
      <div className="form-columns">
        <FormField label="标签"><input maxLength={40} value={tag} onChange={e => setTag(e.target.value)} placeholder="公告" /></FormField>
        <FormField label="关联项目"><Choice label="关联项目" value={programName} onChange={setProgramName} options={['不关联项目', ...s.programs.map(p => p.name)]} /></FormField>
      </div>
      <FormField label="留言对象"><Choice label="留言对象" value={audienceLabel} onChange={v => { setAudienceLabel(v); setPicked([]); }} options={AUDIENCE_OPTIONS} /></FormField>
      {needPick && (
        <div className="ann-pick">
          <div className="ann-pick-head"><Users size={15} /><span>选择{audience === 'selected_teachers' ? '老师' : '对象'}（已选 {picked.length}）</span>
            {pickable.length > 0 && <button type="button" className="text-button" onClick={() => setPicked(picked.length === pickable.length ? [] : pickable.map(u => u.id))}>{picked.length === pickable.length ? '清空' : '全选'}</button>}
          </div>
          {!pickable.length ? <p className="muted">暂无可选账号</p> : (
            <ul className="ann-pick-list">{pickable.map(u => {
              const on = picked.includes(u.id);
              return <li key={u.id}><label className={on ? 'on' : ''}><input type="checkbox" checked={on} onChange={() => setPicked(p => on ? p.filter(x => x !== u.id) : [...p, u.id])} /><strong>{u.name}</strong><small>{u.email} · {u.role}</small></label></li>;
            })}</ul>
          )}
        </div>
      )}
      <div className="actions"><button type="button" className="secondary" onClick={onDone}>取消</button><button className="primary" type="submit" disabled={busy}>{busy ? '发布中…' : '发布留言'}</button></div>
    </form>
  );
}

function ReadsDialog({ announcement, onClose }: { announcement: Announcement; onClose: () => void }) {
  const s = useNexus();
  const [rows, setRows] = useState<AnnouncementReadRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void s.loadAnnouncementReads(announcement.id).then(r => { setRows(r.rows); if (r.error) setError(r.error); });
  }, [announcement.id, s]);
  const read = rows?.filter(r => r.read).length ?? 0;
  const total = rows?.length ?? 0;
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="ops-dialog ann-reads-dialog">
        <DialogHeader>
          <DialogTitle>已读情况 · {announcement.title}</DialogTitle>
          <DialogDescription>{AUDIENCE_LABELS[announcement.audience]} · {rows ? `${read}/${total} 已读` : '加载中…'}</DialogDescription>
        </DialogHeader>
        {error && <Notice>{error}</Notice>}
        {rows && (
          <ul className="ann-reads-list">
            {rows.map(r => (
              <li key={r.userId} className={r.read ? 'read' : 'unread'}>
                <span className="ann-read-dot" aria-hidden />
                <div><strong>{r.name}</strong><small>{r.email} · {r.role}</small></div>
                <em>{r.read ? (r.readAt ? r.readAt.slice(0, 16).replace('T', ' ') : '已读') : '未读'}</em>
              </li>
            ))}
            {!rows.length && <li className="muted">暂无目标对象</li>}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementsPage() {
  const s = useNexus();
  const ops = isOpsLike(s.role);
  const [compose, setCompose] = useState(false);
  const [readsFor, setReadsFor] = useState<Announcement | null>(null);
  const list = s.announcements;

  return (
    <>
      <PageTitle title="项目公告" en="ANNOUNCEMENTS" description="定向留言、通知角标与已读回执，让每一条重要消息都及时抵达。" action={ops ? '发布留言' : undefined} onAction={() => setCompose(true)} />
      {compose && ops && <ComposeForm onDone={() => setCompose(false)} />}
      {list.length ? (
        <div className="feedback-list">
          {list.map(a => (
            <article key={a.id} className={'glass panel prose ann-card' + (a.read ? '' : ' unread')}>
              <div className="card-top">
                <Badge>{a.tag}</Badge>
                <Badge tone="neutral">{AUDIENCE_LABELS[a.audience]}</Badge>
                {!a.read && <Badge tone="pink">未读</Badge>}
                <small>{a.date} · {a.authorName}</small>
              </div>
              <h2>{a.title}</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{a.body}</p>
              <div className="actions">
                {a.program && <button className="secondary" onClick={() => s.go('programs/' + a.program)}>查看关联项目</button>}
                {!a.read && <button className="secondary" onClick={async () => { if (await s.markAnnouncementRead(a.id)) toast.success('已标为已读'); }}><CheckCheck size={15} />标为已读</button>}
                {ops && a.authorId === (s.user?.id || 0) && (
                  <button className="secondary" onClick={() => setReadsFor(a)}>
                    <Eye size={15} />已读 {a.readCount ?? 0}/{a.recipientCount ?? '—'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="glass panel">
          <EmptyState icon={Megaphone} title="暂无公告" description={ops ? '发布定向留言后，目标对象会在通知铃铛看到角标，下次登录也会弹出未读公告。' : '运营老师发布公告后会显示在这里。'} action={ops ? '发布留言' : undefined} onAction={() => setCompose(true)} />
        </section>
      )}
      {readsFor && <ReadsDialog announcement={readsFor} onClose={() => setReadsFor(null)} />}
    </>
  );
}

/** Centered modal of unread announcements shown once after login / restore. */
export function UnreadAnnouncementsModal() {
  const s = useNexus();
  const unread = s.announcements.filter(a => !a.read);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [shownSession, setShownSession] = useState(false);

  useEffect(() => {
    if (!s.authenticated || s.restoring || shownSession) return;
    if (unread.length) { setOpen(true); setIndex(0); setShownSession(true); }
  }, [s.authenticated, s.restoring, unread.length, shownSession]);

  if (!open || !unread.length) return null;
  const cur = unread[Math.min(index, unread.length - 1)];
  const dismiss = async () => {
    await s.markAnnouncementRead(cur.id);
    if (index + 1 < unread.length) setIndex(i => i + 1);
    else setOpen(false);
  };
  const dismissAll = async () => {
    await s.markAllAnnouncementsRead();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) void dismiss(); }}>
      <DialogContent className="ann-unread-modal" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>未读公告 · {index + 1}/{unread.length}</DialogTitle>
          <DialogDescription>{cur.authorName} · {cur.date} · {AUDIENCE_LABELS[cur.audience]}</DialogDescription>
        </DialogHeader>
        <div className="ann-unread-body">
          <Badge>{cur.tag}</Badge>
          <h2>{cur.title}</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{cur.body}</p>
        </div>
        <div className="actions center">
          {unread.length > 1 && <button type="button" className="secondary" onClick={() => void dismissAll()}>全部已读</button>}
          <button type="button" className="primary" onClick={() => void dismiss()}>{index + 1 < unread.length ? '已读，下一条' : '知道了'}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
