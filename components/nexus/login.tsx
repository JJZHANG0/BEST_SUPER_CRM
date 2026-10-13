'use client';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {ArrowRight, ArrowUpRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound, UsersRound, Layers3, GraduationCap} from 'lucide-react';
import {assetUrl} from '@/lib/nexus/assets';
import {useNexus} from '@/lib/nexus/store';
import {BrandMark} from '@/components/nexus/brand';
import {salesDemo} from '@/lib/nexus/auth';
import {APP_ENV} from '@/lib/nexus/api';
const workspaces=[{role:'sales',label:'销售顾问'},{role:'ops',label:'运营老师'},{role:'teacher',label:'授课老师'}] as const;

const CREW_WEBP=assetUrl('brand/login-crew.webp'),CREW_SM=assetUrl('brand/login-crew-720.webp'),CREW_PNG=assetUrl('brand/login-crew.png');

export default function Login() {
  const s=useNexus();
  const sales=s.role==='sales';const teacher=s.role==='teacher';
  // Production server: the public sales demo account is disabled, so its fill-in button is not offered.
  const noDemo=s.apiMode&&APP_ENV==='production';
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[help,setHelp]=useState(false),[caps,setCaps]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
  // Hero parallax: pointer position -> CSS vars (skipped for reduced motion / touch).
  const hero=useRef<HTMLElement|null>(null);
  useEffect(()=>{const el=hero.current;if(!el||typeof window==='undefined')return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!window.matchMedia('(pointer: fine)').matches)return;
    let raf=0;const move=(e:PointerEvent)=>{const r=el.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{el.style.setProperty('--px',x.toFixed(3));el.style.setProperty('--py',y.toFixed(3))})};
    const leave=()=>{el.style.setProperty('--px','0');el.style.setProperty('--py','0')};
    el.addEventListener('pointermove',move);el.addEventListener('pointerleave',leave);
    return()=>{cancelAnimationFrame(raf);el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',leave)}},[]);
  const choose=(role:'sales'|'ops'|'teacher')=>{s.setRole(role);setEmail('');setPassword('');setError('');setHelp(false)};
  const submit=(event:FormEvent)=>{
    event.preventDefault();if(busy)return;
    // API build: verified by the server. Pages build: verified in the browser against hashed accounts.
    setError('');setBusy(true);
    s.login(email,password).then(r=>{if(r.ok)s.go('dashboard');else{setError(r.error);setBusy(false)}});
  };
  return <main className="access-page">
    <div className="access-aura" aria-hidden="true"/>
    <header className="access-header"><BrandMark href="#/login" className="access-brand" label="B.E.S.T 内部超级管理系统 · 登录页"/></header>
    <div className="access-layout">
      <section className="access-hero" ref={hero} aria-label="B.E.S.T 协作平台">
        <div className="access-hero-copy">
          <h1>连接每一份热爱，<br/>让成长<span>有迹可循。</span></h1>
          <p>销售、运营与授课老师，在同一个空间高效协作。</p>
        </div>
        <div className="access-hero-art">
          <div className="access-hero-glow" aria-hidden="true"/>
          <picture className="access-hero-img">
            <source type="image/webp" srcSet={`${CREW_SM} 720w, ${CREW_WEBP} 1320w`} sizes="(max-width: 900px) 90vw, 560px"/>
            <img src={CREW_PNG} width={960} height={638} alt="B.E.S.T 的伙伴们：小兔、小猪、哈士奇、小猫和胡萝卜" decoding="async" fetchPriority="high"/>
          </picture>
          <span className="access-hero-shadow" aria-hidden="true"/>
          <span className="access-sparkle s1" aria-hidden="true"/><span className="access-sparkle s2" aria-hidden="true"/><span className="access-sparkle s3" aria-hidden="true"/>
        </div>
      </section>
      <section className="access-card" aria-labelledby="access-title">
        <h2 id="access-title">欢迎回来</h2><p className="access-subtitle">请选择身份并登录您的账号</p>
        <fieldset className="access-role access-role-3" disabled={busy}><legend className="sr-only">选择登录身份</legend>{workspaces.map(a=>{const on=a.role==='sales'?sales:a.role==='teacher'?teacher:!sales&&!teacher;return <button type="button" key={a.role} data-ws={a.role} aria-pressed={on} onClick={()=>choose(a.role)}>{a.role==='sales'?<UsersRound size={17}/>:a.role==='teacher'?<GraduationCap size={17}/>:<Layers3 size={17}/>}<span>{a.label}</span>{on&&<Check size={14} className="access-role-check" aria-hidden="true"/>}</button>})}</fieldset>
        <form onSubmit={submit} className="access-form" aria-busy={busy}>
          <label htmlFor="access-email">用户名（姓名）</label><div className="access-input"><UserRound size={18}/><input id="access-email" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={120} placeholder={sales&&!noDemo?salesDemo.email:'例如：张捷嘉'} value={email} disabled={busy} aria-invalid={!!error} aria-describedby={error?'access-error':undefined} onChange={e=>{setEmail(e.target.value);setError('')}}/></div>
          <div className="access-password-label"><label htmlFor="access-password">登录密码</label><button type="button" disabled={busy} onClick={()=>setHelp(!help)} aria-expanded={help}>需要帮助？</button></div>
          <div className="access-input"><LockKeyhole size={18}/><input id="access-password" type={show?'text':'password'} autoComplete="current-password" required placeholder="请输入账号密码" value={password} disabled={busy} aria-invalid={!!error} aria-describedby={error?'access-error':undefined} onKeyUp={e=>setCaps(e.getModifierState('CapsLock'))} onBlur={()=>setCaps(false)} onChange={e=>{setPassword(e.target.value);setError('')}}/><button type="button" className="access-reveal" aria-label={show?'隐藏密码':'显示密码'} aria-pressed={show} onClick={()=>setShow(!show)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
          {caps&&<p className="access-help" role="status">大写锁定已开启，请注意密码大小写。</p>}
          {help&&<p className="access-help" role="status">内部账号由管理员分配，不开放注册。运营老师使用本人姓名作为用户名登录（也可使用邮箱），首次登录需修改初始密码；忘记密码请联系超级管理员重置。</p>}
          {error&&<p id="access-error" role="alert" className="access-error">{error}</p>}
          <button className="access-submit" disabled={busy} type="submit">{busy?<><LoaderCircle className="access-spinner" size={19}/>正在进入工作空间…</>:<>登录工作空间<ArrowRight size={19}/></>}</button>
        </form>
        {sales&&!noDemo&&<button type="button" className="access-demo-fill" disabled={busy} onClick={()=>{setEmail(salesDemo.email);setPassword(salesDemo.password);setError('')}}>使用销售示例账号<ArrowUpRight size={15}/></button>}
        {!s.apiMode&&<p className="access-demo-note">当前为预览站：数据只保存在本浏览器，不与他人同步。</p>}
      </section>
    </div>
    <footer className="access-footer"><span>© 2026 B.E.S.T</span><span>如需账号或重置密码，请联系管理员</span></footer>
  </main>;
}
