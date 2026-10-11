'use client';
import { useState, type FormEvent } from 'react';
import { KeyRound, LogOut, Hexagon } from 'lucide-react';
import { toast } from 'sonner';
import { useNexus } from '@/lib/nexus/store';
import { passwordIssues } from '@/lib/nexus/roles';
import { FormField } from './ui';

/** Change-password form used on 个人设置 and by the first-login gate. */
export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const s = useNexus();
  const [current, setCurrent] = useState(''), [next, setNext] = useState(''), [again, setAgain] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const hints = next ? passwordIssues(next) : [];
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== again) return setError('两次输入的新密码不一致');
    setBusy(true); setError('');
    const err = await s.changePassword(current, next);
    setBusy(false);
    if (err) return setError(err);
    setCurrent(''); setNext(''); setAgain('');
    toast.success('密码已修改，下次登录请使用新密码');
    onDone?.();
  };
  return <form className="form-stack password-form" onSubmit={submit}>
    <FormField label="当前密码"><input type="password" autoComplete="current-password" required value={current} onChange={e => { setCurrent(e.target.value); setError(''); }} /></FormField>
    <FormField label="新密码（至少 10 位，包含字母和数字）"><input type="password" autoComplete="new-password" required value={next} onChange={e => { setNext(e.target.value); setError(''); }} /></FormField>
    <FormField label="再次输入新密码"><input type="password" autoComplete="new-password" required value={again} onChange={e => { setAgain(e.target.value); setError(''); }} /></FormField>
    {hints.length > 0 && <p className="muted">新密码需要：{hints.join('，')}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="primary self-start" type="submit" disabled={busy}>{busy ? '正在保存…' : '修改密码'}</button>
  </form>;
}

/** Shown instead of the workspace until a seeded / reset account sets its own password. */
export function PasswordGate() {
  const s = useNexus();
  return <main className="password-gate">
    <section className="glass panel">
      <div className="brand"><span className="brand-icon"><Hexagon size={22} /></span><div>PROJECT <b>NEXUS</b></div></div>
      <div className="password-gate-head"><span className="empty-state-icon"><KeyRound size={22} /></span><div><h1>请先修改初始密码</h1><p>{s.user?.name}，欢迎加入。初始密码由管理员发放，为了账号安全，请设置只有你知道的新密码。</p></div></div>
      <ChangePasswordForm />
      <button className="text-button" onClick={() => { s.logout(); s.go('login'); }}><LogOut size={15} />退出登录</button>
    </section>
  </main>;
}
