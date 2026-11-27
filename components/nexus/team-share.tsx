'use client';

import { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { publicPageUrl } from '@/lib/nexus/api';
import type { Team } from '@/lib/nexus/data';

export function TeamShare({ team }: { team: Team }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState('');
  const [error, setError] = useState(false);
  const url = open ? publicPageUrl('team-showcase/' + encodeURIComponent(team.id)) : '';

  useEffect(() => {
    if (!url) return;
    let active = true;
    import('qrcode').then(({ default: QRCode }) =>
      QRCode.toDataURL(url, { width: 1024, margin: 4, errorCorrectionLevel: 'M' })
    ).then(data => { if (active) setQr(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [url]);

  return <>
    <button type="button" className="secondary compact" onClick={() => { setQr(''); setError(false); setOpen(true); }}>
      <QrCode size={16}/>展示页与二维码
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="ops-dialog">
        <DialogTitle>{team.name} · 展示页</DialogTitle>
        <DialogDescription>把二维码放到课题海报上，家长和学生扫码即可查看。</DialogDescription>
        {qr ? <img className="team-share-qr" src={qr} alt={team.name + '展示页二维码'}/> :
          <p role="status">{error ? '二维码生成失败，请重新打开此窗口。' : '正在生成二维码…'}</p>}
        <div className="actions">
          <a className="secondary" href={url} target="_blank" rel="noopener noreferrer">打开公开页</a>
          <button type="button" className="secondary" onClick={async () => {
            try { await navigator.clipboard.writeText(url); toast.success('展示页链接已复制'); }
            catch { toast.error('复制失败，可以打开公开页后复制地址'); }
          }}>复制链接</button>
          {qr && <a className="primary" href={qr} download={team.id + '-二维码.png'}>下载二维码 PNG</a>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
