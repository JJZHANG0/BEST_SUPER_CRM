'use client';
/** 新建课程 · 排课: 单次 / 每周重复 / 逐次添加. Start times every 15 min; end = start + duration. */
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarPlus, Repeat, Plus, Trash2 } from 'lucide-react';
import { FormField } from './ui';
import { weeklyDates, manualIssue, weekdayLabels, isoWeekday, addDays, MAX_SESSIONS, type ManualSlot } from '@/lib/nexus/schedule';
import { timeRangeIssue, durationLabel, minutesLabel, today as todayIso, TIME_OPTIONS_15, DURATION_OPTIONS_MIN, snapTo15, endFromDuration, durationFromRange } from '@/lib/nexus/ops';

export type ScheduleMode = 'once' | 'weekly' | 'manual';
export type ScheduleValue = { mode: ScheduleMode; slots: ManualSlot[]; issue: string | null };

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const wd = (d: string) => weekdayLabels[isoWeekday(d) - 1];
const DEFAULT_START = '14:00';
const DEFAULT_DUR = 90;

/** Ensure the option list includes the current value (legacy non-15 times / custom durations). */
function withExtra(options: readonly string[], value: string) {
  if (!value || options.includes(value)) return options;
  return [...options, value].sort();
}
function withDurExtra(options: readonly number[], value: number) {
  if (!value || (options as readonly number[]).includes(value)) return options;
  return [...options, value].sort((a, b) => a - b);
}

function TimeSelect({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel: string }) {
  const opts = withExtra(TIME_OPTIONS_15, value);
  return <select className="time-select" aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)} required>
    {opts.map(t => <option key={t} value={t}>{t}</option>)}
  </select>;
}
function DurationSelect({ value, onChange, ariaLabel = '课时长度' }: { value: number; onChange: (v: number) => void; ariaLabel?: string }) {
  const opts = withDurExtra(DURATION_OPTIONS_MIN, value);
  return <select className="time-select duration-select" aria-label={ariaLabel} value={value} onChange={e => onChange(Number(e.target.value))} required>
    {opts.map(m => <option key={m} value={m}>{minutesLabel(m)}</option>)}
  </select>;
}

export function ScheduleFields({ onChange, initialDate, initialSlots }: { onChange: (v: ScheduleValue) => void; initialDate?: string; /** Prefill as 逐次添加 (edit course). */ initialSlots?: ManualSlot[] }) {
  const start0 = initialSlots?.[0]?.date || initialDate || todayIso();
  const editing = !!(initialSlots && initialSlots.length);
  const initStart = snapTo15(initialSlots?.[0]?.start || DEFAULT_START) || DEFAULT_START;
  const initDur = durationFromRange(initialSlots?.[0]?.start || initStart, initialSlots?.[0]?.end || endFromDuration(initStart, DEFAULT_DUR), DEFAULT_DUR);
  const [mode, setMode] = useState<ScheduleMode>(editing ? 'manual' : 'once');
  const [date, setDate] = useState(start0);
  const [start, setStart] = useState(initStart);
  const [duration, setDuration] = useState(initDur);
  const end = endFromDuration(start, duration);
  const [weekdays, setWeekdays] = useState<number[]>([isoWeekday(start0)]);
  const [endBy, setEndBy] = useState<'count' | 'until'>('count');
  const [count, setCount] = useState('8'), [until, setUntil] = useState(addDays(start0, 56));
  const [rows, setRows] = useState<ManualSlot[]>(() => {
    if (editing) return initialSlots!.map(x => {
      const s = snapTo15(x.start) || x.start;
      const d = durationFromRange(x.start, x.end, initDur);
      return { date: x.date, start: s, end: endFromDuration(s, d) || x.end };
    });
    const e = endFromDuration(DEFAULT_START, DEFAULT_DUR);
    return [{ date: start0, start: DEFAULT_START, end: e }, { date: addDays(start0, 7), start: DEFAULT_START, end: e }];
  });
  const [rowDurs, setRowDurs] = useState<number[]>(() =>
    (editing ? initialSlots! : [{ start: DEFAULT_START, end: endFromDuration(DEFAULT_START, DEFAULT_DUR) }, { start: DEFAULT_START, end: endFromDuration(DEFAULT_START, DEFAULT_DUR) }])
      .map(x => durationFromRange(x.start, x.end, DEFAULT_DUR)));

  const value = useMemo<ScheduleValue>(() => {
    if (mode === 'once') {
      const t = timeRangeIssue(start, end);
      return { mode, slots: date && !t ? [{ date, start, end }] : [], issue: !date ? '请选择上课日期' : t };
    }
    if (mode === 'weekly') {
      const r = weeklyDates({ startDate: date, weekdays, start, end, count: endBy === 'count' ? (count === '' ? NaN : Number(count)) : null, until: endBy === 'until' ? until : null });
      return { mode, slots: r.dates.map(d => ({ date: d, start, end })), issue: r.issue };
    }
    return { mode, slots: rows, issue: manualIssue(rows) };
  }, [mode, date, start, end, weekdays, endBy, count, until, rows]);
  useEffect(() => { onChange(value); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDay = (d: number) => setWeekdays(l => l.includes(d) ? l.filter(x => x !== d) : [...l, d].sort());
  const setRowDate = (i: number, v: string) => setRows(l => l.map((r, j) => j === i ? { ...r, date: v } : r));
  const setRowStart = (i: number, v: string) => {
    const s = snapTo15(v) || v;
    setRows(l => l.map((r, j) => j === i ? { ...r, start: s, end: endFromDuration(s, rowDurs[i] || DEFAULT_DUR) } : r));
  };
  const setRowDur = (i: number, d: number) => {
    setRowDurs(l => l.map((x, j) => j === i ? d : x));
    setRows(l => l.map((r, j) => j === i ? { ...r, end: endFromDuration(r.start, d) } : r));
  };
  const addRow = () => setRows(l => {
    const last = l[l.length - 1];
    const d = rowDurs[l.length - 1] || DEFAULT_DUR;
    const next = last ? { date: addDays(last.date, 7), start: last.start, end: endFromDuration(last.start, d) } : { date: start0, start: DEFAULT_START, end: endFromDuration(DEFAULT_START, DEFAULT_DUR) };
    setRowDurs(ds => [...ds, d]);
    return [...l, next];
  });
  const removeRow = (i: number) => {
    setRows(l => l.filter((_, j) => j !== i));
    setRowDurs(l => l.filter((_, j) => j !== i));
  };

  const time = <div className="time-range time-range-duration">
    <FormField label="开始时间"><TimeSelect value={start} onChange={v => setStart(snapTo15(v) || v)} ariaLabel="开始时间" /></FormField>
    <FormField label="课时长度"><DurationSelect value={duration} onChange={setDuration} /></FormField>
    <span className={'duration' + (timeRangeIssue(start, end) ? ' bad' : '')} aria-live="polite">
      {timeRangeIssue(start, end) || <>结束 <b>{end}</b> · 每节 {durationLabel(start, end)}</>}
    </span>
  </div>;

  return <div className="schedule-fields">
    <div className="schedule-modes" role="radiogroup" aria-label="排课方式">
      {([['once', '单次课程', CalendarClock], ['weekly', '每周重复', Repeat], ['manual', '逐次添加', CalendarPlus]] as const).map(([k, l, Icon]) =>
        <button key={k} type="button" role="radio" aria-checked={mode === k} className={mode === k ? 'selected' : ''} onClick={() => setMode(k)}><Icon size={15} />{l}</button>)}
    </div>
    {mode === 'once' && <><FormField label="上课日期"><input type="date" required value={date} onChange={e => setDate(e.target.value)} /></FormField>{time}</>}
    {mode === 'weekly' && <>
      <div className="form-field"><span>每周上课日</span><div className="weekday-picks" role="group" aria-label="每周上课日">
        {weekdayLabels.map((l, i) => <button key={l} type="button" aria-pressed={weekdays.includes(i + 1)} className={weekdays.includes(i + 1) ? 'selected' : ''} onClick={() => toggleDay(i + 1)}>{l}</button>)}
      </div></div>
      <div className="form-columns">
        <FormField label="开始日期"><input type="date" required value={date} onChange={e => setDate(e.target.value)} /></FormField>
        <div className="form-field"><span>结束方式</span><div className="end-by">
          <label className={endBy === 'count' ? 'selected' : ''}><input type="radio" name="end-by" checked={endBy === 'count'} onChange={() => setEndBy('count')} />共<input type="number" min={1} max={MAX_SESSIONS} aria-label="上课次数" value={count} onFocus={() => setEndBy('count')} onChange={e => setCount(e.target.value)} />节</label>
          <label className={endBy === 'until' ? 'selected' : ''}><input type="radio" name="end-by" checked={endBy === 'until'} onChange={() => setEndBy('until')} />截止<input type="date" aria-label="截止日期" value={until} onFocus={() => setEndBy('until')} onChange={e => setUntil(e.target.value)} /></label>
        </div></div>
      </div>
      {time}
    </>}
    {mode === 'manual' && <div className="manual-slots">
      {rows.map((r, i) => <div className="manual-slot" key={i}>
        <em>{i + 1}</em>
        <input type="date" aria-label={`第 ${i + 1} 节日期`} value={r.date} onChange={e => setRowDate(i, e.target.value)} />
        <TimeSelect value={r.start} onChange={v => setRowStart(i, v)} ariaLabel={`第 ${i + 1} 节开始`} />
        <DurationSelect value={rowDurs[i] || DEFAULT_DUR} onChange={d => setRowDur(i, d)} ariaLabel={`第 ${i + 1} 节课时长度`} />
        <span className="manual-end" title="结束时间由开始时间 + 课时长度自动计算">→ {r.end}</span>
        <button type="button" className="icon-button" aria-label={`删除第 ${i + 1} 节`} disabled={rows.length < 2} onClick={() => removeRow(i)}><Trash2 size={15} /></button>
      </div>)}
      <button type="button" className="secondary compact add-slot" onClick={addRow} disabled={rows.length >= MAX_SESSIONS}><Plus size={15} />再加一节（默认顺延一周）</button>
    </div>}
    <div className={'schedule-preview' + (value.issue ? ' bad' : '')} aria-live="polite">
      {value.issue ? <span>{value.issue}</span> : <>
        <strong>共 {value.slots.length} 节</strong>
        <span>{md(value.slots[0].date)}（{wd(value.slots[0].date)}）{value.slots.length > 1 ? ` → ${md(value.slots[value.slots.length - 1].date)}（${wd(value.slots[value.slots.length - 1].date)}）` : ''}</span>
        <div className="slot-chips">{value.slots.slice(0, 16).map((x, i) => <i key={i} title={`${x.date} ${x.start}–${x.end}`}>{md(x.date)} {wd(x.date).slice(1)}</i>)}{value.slots.length > 16 && <i className="more">+{value.slots.length - 16}</i>}</div>
      </>}
    </div>
  </div>;
}
