'use client';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {ArrowRight, ArrowUpRight, Check, Eye, EyeOff, Hexagon, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, UserRound, Sparkles, UsersRound, Layers3} from 'lucide-react';
import {useNexus} from '@/lib/nexus/store';
import {salesDemo} from '@/lib/nexus/auth';
const workspaces=[{role:'sales',label:'销售顾问'},{role:'ops',label:'运营老师'}] as const;

export default function Login() {
  const s=useNexus();
  const sales=s.role==='sales';
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[help,setHelp]=useState(false),[caps,setCaps]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
  const choose=(role:'sales'|'ops')=>{s.setRole(role);setEmail('');setPassword('');setError('');setHelp(false)};
  const submit=(event:FormEvent)=>{
    event.preventDefault();if(busy)return;
    // API build: verified by the server. Pages build: verified in the browser against hashed accounts.
    setError('');setBusy(true);
    s.login(email,password).then(r=>{if(r.ok)s.go('dashboard');else{setError(r.error);setBusy(false)}});
  };
  return <main className="access-page">
    <div className="access-aura" aria-hidden="true"/>
    <header className="access-header"><a className="access-brand" href="#/login" aria-label="PROJECT NEXUS 登录页"><span><Hexagon size={24}/></span><div>PROJECT <b>NEXUS</b></div></a><span className="access-internal"><LockKeyhole size={14}/>内部协作空间</span></header>
    <div className="access-layout">
      <section className="access-story" aria-label="平台介绍">
        <div className="access-kicker"><span/> CONNECT PEOPLE. INSPIRE POSSIBILITIES.</div>
        <h1>连接每一份热爱，<br/>让成长<span>有迹可循。</span></h1>
        <p className="access-intro">从第一次了解，到每一次进步。<br/>让销售与运营，在同一个空间高效协作。</p>
        <div className="crystal-scene" aria-hidden="true">
          <div className="crystal-orbit orbit-one"/><div className="crystal-orbit orbit-two"/>
          <div className="crystal-halo"/>
          <div className="nexus-crystal"><div className="crystal-face face-one"/><div className="crystal-face face-two"/><div className="crystal-face face-three"/><Hexagon size={58} strokeWidth={1}/></div>
          <div className="crystal-label label-program"><span><Layers3 size={20}/></span><div>每一个项目<small>清晰连接，及时同步</small></div><ArrowUpRight size={17}/></div>
          <div className="crystal-label label-student"><span><UsersRound size={20}/></span><div>每一份成长<small>共同关注，全程陪伴</small></div><i><Check size={13}/></i></div>
          <span className="crystal-spark spark-one">✧</span><span className="crystal-spark spark-two">✧</span>
        </div>
        <div className="access-story-footer"><span>01 / 一个工作空间</span><span>无限协作可能 <ArrowRight size={14}/></span></div>
      </section>
      <section className="access-card" aria-labelledby="access-title">
        <div className="access-card-top"><span className="access-symbol"><KeyRound size={22}/></span><span><i/> INVITATION ONLY</span></div>
        <div className="access-welcome">WELCOME TO YOUR WORKSPACE</div>
        <h2 id="access-title">欢迎回来</h2><p className="access-subtitle">使用内部授权账号，开启今天的协作。</p>
        <fieldset className="access-role" disabled={busy}><legend className="sr-only">选择工作空间</legend>{workspaces.map(a=>{const on=a.role==='sales'?sales:!sales;return <button type="button" key={a.role} aria-pressed={on} onClick={()=>choose(a.role)}>{a.role==='sales'?<UsersRound size={17}/>:<Layers3 size={17}/>}<span>{a.label}</span>{on&&<Check size={14}/>}</button>})}</fieldset>
        <form onSubmit={submit} className="access-form" aria-busy={busy}>
          <label htmlFor="access-email">用户名（姓名）</label><div className="access-input"><UserRound size={18}/><input id="access-email" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={120} placeholder={sales?salesDemo.email:'例如：张捷嘉'} value={email} disabled={busy} aria-invalid={!!error} aria-describedby={error?'access-error':undefined} onChange={e=>{setEmail(e.target.value);setError('')}}/></div>
          <div className="access-password-label"><label htmlFor="access-password">登录密码</label><button type="button" disabled={busy} onClick={()=>setHelp(!help)} aria-expanded={help}>需要帮助？</button></div>
          <div className="access-input"><LockKeyhole size={18}/><input id="access-password" type={show?'text':'password'} autoComplete="current-password" required placeholder="请输入账号密码" value={password} disabled={busy} aria-invalid={!!error} aria-describedby={error?'access-error':undefined} onKeyUp={e=>setCaps(e.getModifierState('CapsLock'))} onBlur={()=>setCaps(false)} onChange={e=>{setPassword(e.target.value);setError('')}}/><button type="button" className="access-reveal" aria-label={show?'隐藏密码':'显示密码'} aria-pressed={show} onClick={()=>setShow(!show)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
          {caps&&<p className="access-help" role="status">大写锁定已开启，请注意密码大小写。</p>}
          {help&&<p className="access-help" role="status">内部账号由管理员分配，不开放注册。运营老师使用本人姓名作为用户名登录（也可使用邮箱），首次登录需修改初始密码；忘记密码请联系超级管理员重置。</p>}
          {error&&<p id="access-error" role="alert" className="access-error">{error}</p>}
          <button className="access-submit" disabled={busy} type="submit">{busy?<><LoaderCircle className="access-spinner" size={19}/>正在进入工作空间…</>:<>登录工作空间<ArrowRight size={19}/></>}</button>
        </form>
        <div className="access-authorized"><ShieldCheck size={15}/><span>仅限已授权成员 · 无需自行注册</span></div>
        {sales?<div className="access-demo"><div><Sparkles size={16}/><strong>体验销售顾问工作空间</strong><span>冰晶蓝</span></div><p>示例账号</p><button type="button" disabled={busy} onClick={()=>{setEmail(salesDemo.email);setPassword(salesDemo.password);setError('')}}>填入销售示例账号<ArrowUpRight size={16}/></button></div>
        :<div className="access-demo"><div><Sparkles size={16}/><strong>运营老师工作空间</strong><span>冰晶紫</span></div><p>使用管理员分配的账号登录，首次登录需修改初始密码。</p></div>}
        {!s.apiMode&&<p className="access-demo-note">当前为预览站：数据只保存在本浏览器，不与他人同步。</p>}
      </section>
    </div>
    <footer className="access-footer"><span>© 2026 PROJECT NEXUS</span><span>Innovation, connected.<i/>教育创新 · 协作共生</span></footer>
  </main>;
}
