'use client';
/**
 * 收集表单 public page (#/f/<slug>): no login, mobile-first, works in WeChat's in-app browser.
 * Bilingual questions (中文 title + ENGLISH caps line), grouped sections, progress, inline validation,
 * local draft autosave, honeypot + minimum fill time against spam, and a success screen.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, CircleAlert, Loader2, Lock, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { publicFormApi, ApiError, type PublicFormDef } from '@/lib/nexus/api';
import { OTHER_SEP, optionPart, validateAnswers, type AnswerValue, type FormQuestion } from '@/lib/nexus/forms';
import { BUNNY_PNG, BUNNY_WEBP } from '@/components/nexus/brand';

type Q = PublicFormDef['questions'][number];
type Section = { head: Q | null; items: Q[] };
const asQ = (q: Q): FormQuestion => ({ ...q, mapTo: '' });
const nowMs = () => Date.now();
const draftKey = (slug: string) => 'nexus.formdraft.' + slug;

function Bunny({ className = '' }: { className?: string }) {
  return <picture className={className} aria-hidden="true"><source srcSet={BUNNY_WEBP} type="image/webp" /><img src={BUNNY_PNG} alt="" draggable={false} decoding="async" /></picture>;
}

export function PublicForm({ slug }: { slug: string }) {
  const [form, setForm] = useState<PublicFormDef | null | 'missing'>(null);
  const [values, setValues] = useState<Record<string, AnswerValue>>({});
  const [others, setOthers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [failure, setFailure] = useState('');
  const [preview, setPreview] = useState(false);
  const [wait, setWait] = useState(0);
  const hp = useRef<HTMLInputElement>(null);
  const started = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.workspace = 'form';
    started.current = nowMs();
    let alive = true;
    publicFormApi.form(slug).then(r => {
      if (!alive) return;
      setForm(r.form); document.title = r.form.title;
      try { const d = JSON.parse(localStorage.getItem(draftKey(slug)) || 'null'); if (d && typeof d === 'object') { setValues(d.values || {}); setOthers(d.others || {}); } } catch { /* no draft */ }
    }).catch(() => alive && setForm('missing'));
    return () => { alive = false; };
  }, [slug]);
  useEffect(() => { if (form && form !== 'missing' && !done) try { localStorage.setItem(draftKey(slug), JSON.stringify({ values, others })); } catch { /* storage blocked */ } }, [values, others, form, slug, done]);

  const questions = useMemo(() => form && form !== 'missing' ? form.questions : [], [form]);
  const sections = useMemo(() => {
    const out: Section[] = [];
    for (const q of questions) { if (q.type === 'section') out.push({ head: q, items: [] }); else { if (!out.length) out.push({ head: null, items: [] }); out[out.length - 1].items.push(q); } }
    return out.filter(s => s.items.length);
  }, [questions]);

  /** Combine option + "其他" free text into stored answers. */
  const compose = (): Record<string, AnswerValue> => {
    const out: Record<string, AnswerValue> = {};
    for (const q of questions) {
      const v = values[q.id]; if (v === undefined) continue;
      const withOther = (x: string) => { const op = q.options.find(o => o.value === x); return op?.other ? x + OTHER_SEP + (others[q.id] || '').trim() : x; };
      out[q.id] = Array.isArray(v) ? v.map(withOther) : q.options.length ? (v ? withOther(v) : '') : v;
    }
    return out;
  };
  const check = () => validateAnswers(questions.map(asQ), compose()).errors;
  const answerable = questions.filter(q => q.type !== 'section');
  const required = answerable.filter(q => q.required);
  const liveErrors = useMemo(() => check(), [values, others, questions]); // eslint-disable-line react-hooks/exhaustive-deps
  const filledReq = required.filter(q => !liveErrors[q.id]).length;
  const pct = required.length ? Math.round(filledReq / required.length * 100) : 100;

  const set = (id: string, v: AnswerValue) => { setValues(x => ({ ...x, [id]: v })); if (errors[id]) setErrors(e => { const n = { ...e }; delete n[id]; return n; }); };
  const blur = (id: string) => { setTouched(t => ({ ...t, [id]: true })); const e = check()[id]; setErrors(x => { const n = { ...x }; if (e) n[id] = e; else delete n[id]; return n; }); };

  /** Submit button: validate, then open the confirm preview (only 确认提交 sends). */
  function submit(ev: React.FormEvent) {
    ev.preventDefault(); setFailure('');
    const errs = check();
    setErrors(errs); setTouched(Object.fromEntries(answerable.map(q => [q.id, true])));
    const first = answerable.find(q => errs[q.id]);
    if (first) { document.getElementById('sfq-' + first.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setFailure(`还有 ${Object.keys(errs).length} 题需要完善 · ${Object.keys(errs).length} FIELD(S) NEED ATTENTION`); return; }
    setWait(3); setPreview(true);
  }
  // 3-second read-through countdown, restarted on every open; lock page scroll behind the sheet.
  useEffect(() => {
    if (!preview) return;
    const body = document.body, prev = body.style.overflow;
    body.style.overflow = 'hidden';
    const timer = window.setInterval(() => setWait(w => { if (w <= 1) { window.clearInterval(timer); return 0; } return w - 1; }), 1000);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setPreview(false); };
    window.addEventListener('keydown', esc);
    return () => { window.clearInterval(timer); body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [preview]); // eslint-disable-line react-hooks/exhaustive-deps
  async function confirmSubmit() {
    if (wait > 0 || busy) return;
    setBusy(true);
    try {
      const r = await publicFormApi.submit(slug, { answers: compose(), website: hp.current?.value || '', elapsed: nowMs() - started.current });
      try { localStorage.removeItem(draftKey(slug)); } catch { /* ignore */ }
      setPreview(false); setDone(r.id); window.scrollTo({ top: 0 });
    } catch (e) {
      const err = e as ApiError;
      setPreview(false);
      if (err instanceof ApiError && err.code === 'too_fast') setFailure('提交过快，请再核对一遍后提交。');
      else setFailure(err instanceof ApiError && err.message ? err.message : '网络异常，请稍后重试（已填写内容已保存在本机）。');
    } finally { setBusy(false); }
  }
  /** Display text for the preview: option labels (zh) + any 其他 text. */
  const display = (q: Q): string => {
    const v = values[q.id];
    if (v == null || (Array.isArray(v) ? !v.length : !String(v).trim())) return '';
    const one = (x: string) => { const o = q.options.find(op => op.value === x); if (!o) return x; return o.other ? `${o.zh}：${(others[q.id] || '').trim()}` : o.zh; };
    return Array.isArray(v) ? v.map(one).join('、') : q.options.length ? one(v) : String(v);
  };
  const sensitive = (q: Q) => q.type === 'phone' || q.type === 'email' || /姓名|证件号码|拼音/.test(q.labelZh);

  if (form === null) return <div className="sf-page"><div className="sf-center"><Loader2 className="sf-spin" size={26} /><p>正在打开表单… <small>LOADING</small></p></div></div>;
  if (form === 'missing') return <div className="sf-page"><div className="sf-center sf-card"><Bunny className="sf-bunny-sm" /><h2>表单不存在或链接已失效</h2><p className="sf-en">THIS FORM IS UNAVAILABLE</p><p>请联系老师获取最新链接。</p></div></div>;
  if (done) return <div className="sf-page"><div className="sf-shell"><div className="sf-card sf-done">
    <div className="sf-done-art"><Bunny className="sf-bunny-done" /><span className="sf-done-check"><Check size={30} strokeWidth={3} /></span></div>
    <h1>提交成功</h1><p className="sf-en">SUBMITTED SUCCESSFULLY</p>
    <p className="sf-done-text">感谢填写！老师会尽快核对你的报名信息，如有问题将通过手机或邮箱联系你。</p>
    <p className="sf-done-en">Thank you! Our team will review your information and contact you by phone or email if anything needs confirming.</p>
    <div className="sf-ref">回执编号 · REFERENCE <b>{done.slice(-8)}</b></div>
    <p className="sf-small">请截图保存本页面 · Please keep a screenshot of this page.</p>
  </div><Footer /></div></div>;

  const numbers = new Map(answerable.map((q, i) => [q.id, i + 1]));
  return <div className="sf-page">
    <div className="sf-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="必填完成度">
      <div className="sf-progress-bar"><i style={{ width: pct + '%' }} /></div>
      <span>{filledReq}/{required.length} 必填 · {pct}%</span>
    </div>
    <div className="sf-shell">
      <header className="sf-hero sf-card">
        <div className="sf-brand"><span className="sf-logo">B<i>.</i>E<i>.</i>S<i>.</i>T</span><span className="sf-tag"><Sparkles size={12} /> 报名信息收集</span></div>
        <Bunny className="sf-bunny" />
        <h1>{form.title}</h1>
        {form.titleEn && <p className="sf-en sf-en-lg">{form.titleEn}</p>}
        {form.intro && <p className="sf-intro">{form.intro}</p>}
        {form.introEn && <p className="sf-intro-en">{form.introEn}</p>}
        <div className="sf-chips"><span>约 5–8 分钟 · 5–8 MIN</span><span><b>*</b> 为必填 · REQUIRED</span><span>自动保存草稿 · AUTO-SAVED</span></div>
      </header>
      {!form.open ? <div className="sf-card sf-closed"><Lock size={22} /><div><h2>该表单已停止收集</h2><p className="sf-en">THIS FORM IS CLOSED</p><p>如需报名，请联系负责老师。</p></div></div> :
      <form onSubmit={submit} noValidate>
        <div className="sf-hp" aria-hidden="true"><label>Website<input ref={hp} name="website" tabIndex={-1} autoComplete="off" /></label></div>
        {sections.map((sec, si) => <section key={sec.head?.id || si} className="sf-card sf-section">
          {sec.head && <div className="sf-section-head"><span className="sf-step">{String(si + 1).padStart(2, '0')}</span><div><h2>{sec.head.labelZh}</h2>{sec.head.labelEn && <p className="sf-en">{sec.head.labelEn}</p>}{sec.head.helpZh && <p className="sf-help">{sec.head.helpZh}</p>}{sec.head.helpEn && <p className="sf-help-en">{sec.head.helpEn}</p>}</div></div>}
          {sec.items.map(q => { const n = numbers.get(q.id) || 0; const err = touched[q.id] ? errors[q.id] : undefined; return <div key={q.id} id={'sfq-' + q.id} className={'sf-q' + (err ? ' has-error' : '')}>
            <label className="sf-label" htmlFor={'sfi-' + q.id}><span className="sf-num">{String(n).padStart(2, '0')}</span><span><span className="sf-zh">{q.labelZh}{q.required && <b className="sf-req">*</b>}</span>{q.labelEn && <span className="sf-en">{q.labelEn}</span>}</span></label>
            {(q.helpZh || q.helpEn) && <p className="sf-help">{q.helpZh}{q.helpEn && <span className="sf-help-en">{q.helpEn}</span>}</p>}
            <Field q={q} value={values[q.id]} other={others[q.id] || ''} onChange={v => set(q.id, v)} onOther={v => setOthers(o => ({ ...o, [q.id]: v }))} onBlur={() => blur(q.id)} />
            {err && <p className="sf-error" role="alert"><CircleAlert size={14} />{err}</p>}
          </div>; })}
        </section>)}
        {failure && <p className="sf-failure" role="alert"><CircleAlert size={16} />{failure}</p>}
        <button type="submit" className="sf-submit" disabled={busy}>{busy ? <Loader2 className="sf-spin" size={18} /> : <Send size={18} />}<span>提交报名信息<small>SUBMIT</small></span></button>
        <p className="sf-small sf-privacy">所收集信息仅用于竞赛报名、注册、赛事通知及证书核对。<br />Your information is used only for competition registration, notices and certificates.</p>
      </form>}
      {preview && <div className="sf-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="sf-preview-title" onClick={e => { if (e.target === e.currentTarget && !busy) setPreview(false); }}>
        <div className="sf-sheet">
          <div className="sf-sheet-grip" aria-hidden="true" />
          <header className="sf-sheet-head">
            <h2 id="sf-preview-title">确认报名信息</h2><p className="sf-en">REVIEW YOUR INFORMATION</p>
            <p className="sf-sheet-tip"><ShieldCheck size={15} /><span>请仔细核对，尤其是姓名拼音、证件号码、手机号和邮箱。<small>PLEASE CHECK CAREFULLY, ESPECIALLY NAME / PINYIN, ID NUMBER, PHONE AND EMAIL.</small></span></p>
          </header>
          <div className="sf-sheet-body">
            {sections.map((sec, si) => { const rows = sec.items.map(q => [q, display(q)] as const).filter(([, v]) => v); if (!rows.length) return null; return <section key={sec.head?.id || si} className="sf-pv-sec">
              {sec.head && <h3>{sec.head.labelZh}<small>{sec.head.labelEn}</small></h3>}
              <dl>{rows.map(([q, v]) => <div key={q.id} className={sensitive(q) ? 'is-key' : undefined}><dt>{q.labelZh.replace(/（选填）$/, '')}</dt><dd>{v}</dd></div>)}</dl>
            </section>; })}
          </div>
          <footer className="sf-sheet-foot">
            <button type="button" className="sf-back" onClick={() => setPreview(false)} disabled={busy}><ArrowLeft size={16} /><span>返回修改<small>BACK TO EDIT</small></span></button>
            <button type="button" className="sf-confirm" onClick={confirmSubmit} disabled={wait > 0 || busy} aria-live="polite">{busy ? <Loader2 className="sf-spin" size={17} /> : wait > 0 ? <span className="sf-count">{wait}s</span> : <Check size={17} strokeWidth={3} />}<span>{wait > 0 ? '请核对信息' : '确认提交'}<small>{wait > 0 ? `PLEASE REVIEW · ${wait}S` : 'CONFIRM & SUBMIT'}</small></span></button>
          </footer>
        </div>
      </div>}
      <Footer />
    </div>
  </div>;
}

function Footer() { return <footer className="sf-footer">© B.E.S.T · 报名信息收集</footer>; }

function Field({ q, value, other, onChange, onOther, onBlur }: { q: Q; value: AnswerValue | undefined; other: string; onChange: (v: AnswerValue) => void; onOther: (v: string) => void; onBlur: () => void }) {
  const id = 'sfi-' + q.id;
  const str = typeof value === 'string' ? value : '';
  const otherOn = (v: string | string[] | undefined) => q.options.some(o => o.other && (Array.isArray(v) ? v.includes(o.value) : v === o.value));
  const otherBox = otherOn(value) && <input className="sf-input sf-other" value={other} onChange={e => onOther(e.target.value)} onBlur={onBlur} placeholder="请注明 · PLEASE SPECIFY" maxLength={200} />;
  switch (q.type) {
    case 'textarea': return <textarea id={id} className="sf-input sf-textarea" value={str} onChange={e => onChange(e.target.value)} onBlur={onBlur} placeholder={q.placeholder} rows={3} maxLength={4000} />;
    case 'date': return <input id={id} type="date" className="sf-input" value={str} onChange={e => onChange(e.target.value)} onBlur={onBlur} min="1950-01-01" max="2030-12-31" />;
    case 'phone': return <input id={id} type="tel" inputMode="tel" autoComplete="tel" className="sf-input" value={str} onChange={e => onChange(e.target.value)} onBlur={onBlur} placeholder={q.placeholder || '例：13800138000 / +852 91234567'} maxLength={24} />;
    case 'email': return <input id={id} type="email" inputMode="email" autoComplete="email" autoCapitalize="off" className="sf-input" value={str} onChange={e => onChange(e.target.value.trim())} onBlur={onBlur} placeholder={q.placeholder || 'name@example.com'} maxLength={120} />;
    case 'number': return <input id={id} type="text" inputMode="decimal" className="sf-input" value={str} onChange={e => onChange(e.target.value)} onBlur={onBlur} placeholder={q.placeholder} maxLength={20} />;
    case 'select': return <><div className="sf-select"><select id={id} className="sf-input" value={str} onChange={e => { onChange(e.target.value); }} onBlur={onBlur}><option value="">请选择 · SELECT</option>{q.options.map(o => <option key={o.value} value={o.value}>{o.zh}{o.en && o.en !== o.zh ? ' · ' + o.en : ''}</option>)}</select><ChevronDown size={16} /></div>{otherBox}</>;
    case 'single': case 'multi': {
      const multi = q.type === 'multi', list = Array.isArray(value) ? value : [];
      const long = q.options.some(o => o.zh.length > 14);
      return <><div className={'sf-options' + (long ? ' is-long' : '')} role={multi ? 'group' : 'radiogroup'} aria-labelledby={id}>{q.options.map(o => {
        const on = multi ? list.includes(o.value) : optionPart(str) === o.value;
        return <button type="button" key={o.value} role={multi ? 'checkbox' : 'radio'} aria-checked={on} className={'sf-option' + (on ? ' is-on' : '')}
          onClick={() => { if (multi) onChange(on ? list.filter(x => x !== o.value) : [...list, o.value]); else onChange(on && !q.required ? '' : o.value); setTimeout(onBlur, 0); }}>
          <span className={'sf-tick' + (multi ? ' is-box' : '')}>{on && <Check size={12} strokeWidth={3.2} />}</span>
          <span className="sf-opt-text"><span>{o.zh}</span>{o.en && o.en !== o.zh && <small>{o.en}</small>}</span>
        </button>;
      })}</div>{otherBox}</>;
    }
    default: return <input id={id} type="text" className="sf-input" value={str} onChange={e => onChange(e.target.value)} onBlur={onBlur} placeholder={q.placeholder} maxLength={500} />;
  }
}
export default PublicForm;
