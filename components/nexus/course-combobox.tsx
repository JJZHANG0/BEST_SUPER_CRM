'use client';
/**
 * 课程 combobox for 记录课时: type to filter live by 课程编号 / 课程名称 / 项目 / 授课老师,
 * ↑ ↓ to move, Enter to pick, Esc to close (restores the current course). WAI-ARIA combobox pattern.
 */
import { Fragment, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronsUpDown, Search } from 'lucide-react';
import { filterCourses, type OpsCourse } from '@/lib/nexus/ops';

const LIMIT = 80;
const label = (c: OpsCourse) => `${c.code} · ${c.name}`;

/** Wrap every occurrence of the query terms in <mark>. */
function highlight(text: string, terms: string[]): ReactNode {
  if (!terms.length || !text) return text;
  const re = new RegExp('(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return text.split(re).map((part, i) => i % 2 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>);
}

export function CourseCombobox({ courses, value, onChange, projectLabel, ariaLabel = '课程' }: {
  courses: readonly OpsCourse[]; value: string; onChange: (id: string) => void; projectLabel: (id: string) => string; ariaLabel?: string;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const selected = courses.find(c => c.id === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null); // null = not typing; show the selected course
  const [active, setActive] = useState(0);
  const typed = query ?? '';
  const terms = typed.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = useMemo(() => filterCourses(courses, typed, projectLabel), [courses, typed, projectLabel]);
  const shown = matches.slice(0, LIMIT);
  const optId = (i: number) => `${listId}-o${i}`;

  const scrollTo = (i: number) => requestAnimationFrame(() => document.getElementById(optId(i))?.scrollIntoView({ block: 'nearest' }));
  const openList = () => {
    if (open) return;
    const i = Math.max(0, shown.findIndex(c => c.id === value));
    setOpen(true); setActive(i); scrollTo(i);
  };
  const close = () => { setOpen(false); setQuery(null); };
  const pick = (c: OpsCourse | undefined) => { if (!c) return; onChange(c.id); close(); };
  const move = (d: number) => {
    if (!open) { if (query === null) setQuery(''); return openList(); }
    if (!shown.length) return;
    const i = (active + d + shown.length) % shown.length; setActive(i); scrollTo(i);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if ((e.key === 'PageDown' || e.key === 'PageUp') && open && shown.length) {
      e.preventDefault(); const i = Math.max(0, Math.min(shown.length - 1, active + (e.key === 'PageDown' ? 8 : -8))); setActive(i); scrollTo(i);
    }
    else if (e.key === 'Enter') { if (open) { e.preventDefault(); pick(shown[active]); } }
    else if (e.key === 'Escape') { if (open) { e.preventDefault(); e.stopPropagation(); close(); } }
    else if (e.key === 'Tab') { if (open && query !== null && shown.length === 1) pick(shown[0]); else close(); }
  };

  return <div className={'course-combobox' + (open ? ' open' : '')}>
    <Search size={15} className="cc-icon" aria-hidden="true" />
    <input ref={input} role="combobox" aria-label={ariaLabel} aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
      aria-activedescendant={open && shown[active] ? optId(active) : undefined} autoComplete="off" spellCheck={false}
      // While open the box is a search field (empty = all courses, current course as placeholder).
      placeholder={selected ? label(selected) : '输入课程编号、名称、项目或授课老师搜索'}
      value={query ?? (selected ? label(selected) : '')}
      onFocus={() => { setQuery(''); openList(); }}
      onClick={openList}
      onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true); list.current?.scrollTo({ top: 0 }); }}
      onBlur={close}
      onKeyDown={onKey} />
    <button type="button" tabIndex={-1} className="cc-caret" aria-label="展开课程列表" onMouseDown={e => { e.preventDefault(); if (open) close(); else { input.current?.focus(); openList(); } }}><ChevronsUpDown size={15} /></button>
    {open && <div ref={list} id={listId} role="listbox" aria-label={ariaLabel + '选项'} className="cc-list">
      {shown.length ? shown.map((c, i) => <div key={c.id} id={optId(i)} role="option" aria-selected={i === active}
        className={'cc-option' + (i === active ? ' active' : '') + (c.id === value ? ' current' : '')}
        onMouseDown={e => { e.preventDefault(); pick(c); }} onMouseMove={() => i !== active && setActive(i)}>
        <span className="cc-code">{highlight(c.code, terms)}</span>
        <span className="cc-name">{highlight(c.name, terms)}</span>
        <small className="cc-meta">{highlight([projectLabel(c.project), c.teacher].filter(Boolean).join(' · '), terms)}</small>
      </div>) : <div className="cc-empty">没有匹配「{typed}」的课程</div>}
      <div className="cc-foot" aria-live="polite">{matches.length > LIMIT ? `显示前 ${LIMIT} 门，共 ${matches.length} 门匹配，继续输入可缩小范围` : `${matches.length} 门课程`} · ↑↓ 选择 · Enter 确认 · Esc 关闭</div>
    </div>}
  </div>;
}

/** One 课程编号 choice for 新建课程 (from 课时记录 courses). */
export type CodeOption = { code: string; name: string; project: string; program: string; programName: string; teams: { id: string; name: string }[]; teacher: string };
const norm = (v: string) => v.trim().replace(/\s+/g, '').toUpperCase();

/**
 * 课程编号 typeahead for 新建课程: matches code / name / project / team as you type (highlighted), ↑↓ Enter Esc.
 * Free text is never kept: leaving the field without picking restores the previous code. A new code is only
 * possible through the explicit 「新建编号 XXX」 option, which is validated with `validate`.
 */
export function CourseCodeCombobox({ options, value, onPick, taken, validate }: {
  options: readonly CodeOption[]; value: string; onPick: (code: string, option: CodeOption | null) => void;
  /** Course already using this code (shown disabled). */ taken: (code: string) => string | undefined;
  /** Format / uniqueness problem of a new code, or null. */ validate: (code: string) => string | null;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const typed = query ?? '';
  const terms = typed.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (() => {
    if (!terms.length) return options.slice();
    const scored: { o: CodeOption; score: number; i: number }[] = [];
    options.forEach((o, i) => {
      const code = o.code.toLowerCase(), hay = [code, o.name, o.project, o.programName, ...o.teams.map(t => t.name), o.teacher].join(' ').toLowerCase();
      if (!terms.every(t => hay.includes(t))) return;
      scored.push({ o, i, score: code.startsWith(terms[0]) ? 0 : code.includes(terms[0]) ? 1 : 2 });
    });
    return scored.sort((a, b) => a.score - b.score || a.i - b.i).map(x => x.o);
  })();
  const shown = matches.slice(0, LIMIT);
  const fresh = norm(typed);
  const offerNew = !!fresh && !options.some(o => norm(o.code) === fresh);
  const newIssue = offerNew ? validate(fresh) : null;
  type Row = { kind: 'opt'; o: CodeOption; busy?: string } | { kind: 'new' };
  const rows: Row[] = [...shown.map(o => ({ kind: 'opt' as const, o, busy: taken(o.code) })), ...(offerNew ? [{ kind: 'new' as const }] : [])];
  const optId = (i: number) => `${listId}-o${i}`;
  const scrollTo = (i: number) => requestAnimationFrame(() => document.getElementById(optId(i))?.scrollIntoView({ block: 'nearest' }));
  const close = () => { setOpen(false); setQuery(null); };
  const pick = (r: Row | undefined) => {
    if (!r) return;
    if (r.kind === 'new') { if (newIssue) return; onPick(fresh, null); }
    else { if (r.busy) return; onPick(r.o.code, r.o); }
    close();
  };
  const move = (d: number) => {
    if (!open) { setOpen(true); if (query === null) setQuery(''); return; }
    if (!rows.length) return;
    const i = (active + d + rows.length) % rows.length; setActive(i); scrollTo(i);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { if (open) { e.preventDefault(); pick(rows[active]); } }
    else if (e.key === 'Escape') { if (open) { e.preventDefault(); e.stopPropagation(); close(); } }
    else if (e.key === 'Tab') close();
  };
  const current = options.find(o => norm(o.code) === norm(value));
  return <div className={'course-combobox code-combobox' + (open ? ' open' : '')}>
    <Search size={15} className="cc-icon" aria-hidden="true" />
    <input ref={input} role="combobox" aria-label="课程编号" aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
      aria-activedescendant={open && rows[active] ? optId(active) : undefined} autoComplete="off" spellCheck={false}
      placeholder={value ? value : '输入编号、课程名、项目或队伍搜索，例如 WS2026017 / 康莱德'}
      value={query ?? value}
      onFocus={() => { setQuery(''); setOpen(true); setActive(0); }}
      onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true); list.current?.scrollTo({ top: 0 }); }}
      onBlur={close} onKeyDown={onKey} />
    {value && !open && <button type="button" className="cc-clear" aria-label="清除课程编号" onMouseDown={e => { e.preventDefault(); onPick('', null); }}>×</button>}
    <button type="button" tabIndex={-1} className="cc-caret" aria-label="展开课程编号列表" onMouseDown={e => { e.preventDefault(); if (open) close(); else input.current?.focus(); }}><ChevronsUpDown size={15} /></button>
    {!open && value && <small className="cc-hint">{current ? `${current.name}${current.teams.length ? ' · ' + current.teams.map(t => t.name).join('、') : ''}` : '新建编号（课时记录中暂无此课程）'}</small>}
    {open && <div ref={list} id={listId} role="listbox" aria-label="课程编号选项" className="cc-list">
      {rows.map((r, i) => r.kind === 'opt'
        ? <div key={r.o.code} id={optId(i)} role="option" aria-selected={i === active} aria-disabled={!!r.busy}
            className={'cc-option' + (i === active ? ' active' : '') + (norm(r.o.code) === norm(value) ? ' current' : '') + (r.busy ? ' disabled' : '')}
            onMouseDown={e => { e.preventDefault(); pick(r); }} onMouseMove={() => i !== active && setActive(i)}>
            <span className="cc-code">{highlight(r.o.code, terms)}</span>
            <span className="cc-name">{highlight(r.o.name, terms)}</span>
            <small className="cc-meta">{r.busy ? `已被课程「${r.busy}」使用` : highlight([r.o.project, r.o.programName, r.o.teams.map(t => t.name).join('、'), r.o.teacher].filter(Boolean).join(' · '), terms)}</small>
          </div>
        : <div key="__new" id={optId(i)} role="option" aria-selected={i === active} aria-disabled={!!newIssue}
            className={'cc-option cc-new' + (i === active ? ' active' : '') + (newIssue ? ' disabled' : '')}
            onMouseDown={e => { e.preventDefault(); pick(r); }} onMouseMove={() => i !== active && setActive(i)}>
            <span className="cc-code">＋ 新建编号 {fresh}</span>
            <small className="cc-meta">{newIssue || '课时记录中没有此编号，将作为新编号保存'}</small>
          </div>)}
      {!rows.length && <div className="cc-empty">输入编号或关键字搜索</div>}
      <div className="cc-foot" aria-live="polite">{matches.length > LIMIT ? `显示前 ${LIMIT} 个，共 ${matches.length} 个匹配` : `${matches.length} 个匹配`} · ↑↓ 选择 · Enter 确认 · Esc 关闭</div>
    </div>}
  </div>;
}
