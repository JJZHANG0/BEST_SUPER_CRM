'use client';
/** 新建课程 · 排课: 单次 / 每周重复 / 逐次添加. Produces the session slots the course form saves to course_sessions. */
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarPlus, Repeat, Plus, Trash2 } from 'lucide-react';
import { FormField } from './ui';
import { weeklyDates, manualIssue, weekdayLabels, isoWeekday, addDays, MAX_SESSIONS, type ManualSlot } from '@/lib/nexus/schedule';
import { timeRangeIssue, durationLabel, today as todayIso } from '@/lib/nexus/ops';

export type ScheduleMode = 'once' | 'weekly' | 'manual';
export type ScheduleValue = { mode: ScheduleMode; slots: ManualSlot[]; issue: string | null };

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const wd = (d: string) => weekdayLabels[isoWeekday(d) - 1];

export function ScheduleFields({ onChange, initialDate }: { onChange: (v: ScheduleValue) => void; initialDate?: string }) {
  const start0 = initialDate || todayIso();
  const [mode, setMode] = useState<ScheduleMode>('once');
  const [date, setDate] = useState(start0);
  const [start, setStart] = useState('14:00'), [end, setEnd] = useState('15:30');
  const [weekdays, setWeekdays] = useState<number[]>([isoWeekday(start0)]);
  const [endBy, setEndBy] = useState<'count' | 'until'>('count');
  const [count, setCount] = useState('8'), [until, setUntil] = useState(addDays(start0, 56));
  const [rows, setRows] = useState<ManualSlot[]>([{ date: start0, start: '14:00', end: '15:30' }, { date: addDays(start0, 7), start: '14:00', end: '15:30' }]);

  const value = useMemo<ScheduleValue>(() => {
    if (mode === 'once') { const t = timeRangeIssue(start, end); return { mode, slots: date && !t ? [{ date, start, end }] : [], issue: !date ? '请选择上课日期' : t }; }
    if (mode === 'weekly') {
      const r = weeklyDates({ startDate: date, weekdays, start, end, count: endBy === 'count' ? (count === '' ? NaN : Number(count)) : null, until: endBy === 'until' ? until : null });
      return { mode, slots: r.dates.map(d => ({ date: d, start, end })), issue: r.issue };
    }
    return { mode, slots: rows, issue: manualIssue(rows) };
  }, [mode, date, start, end, weekdays, endBy, count, until, rows]);
  useEffect(() => { onChange(value); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDay = (d: number) => setWeekdays(l => l.includes(d) ? l.filter(x => x !== d) : [...l, d].sort());
  const setRow = (i: number, k: keyof ManualSlot, v: string) => setRows(l => l.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows(l => { const last = l[l.length - 1]; return [...l, last ? { ...last, date: addDays(last.date, 7) } : { date: start0, start: '14:00', end: '15:30' }]; });
  const time = <div className="time-range">
    <FormField label="开始时间"><input type="time" required aria-label="开始时间" value={start} onChange={e => setStart(e.target.value)} /></FormField>
    <FormField label="结束时间"><input type="time" required aria-label="结束时间" value={end} onChange={e => setEnd(e.target.value)} /></FormField>
    <span className={'duration' + (timeRangeIssue(start, end) ? ' bad' : '')} aria-live="polite">{timeRangeIssue(start, end) || '每节 ' + durationLabel(start, end)}</span>
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
        <input type="date" aria-label={`第 ${i + 1} 节日期`} value={r.date} onChange={e => setRow(i, 'date', e.target.value)} />
        <input type="time" aria-label={`第 ${i + 1} 节开始`} value={r.start} onChange={e => setRow(i, 'start', e.target.value)} />
        <span>–</span>
        <input type="time" aria-label={`第 ${i + 1} 节结束`} value={r.end} onChange={e => setRow(i, 'end', e.target.value)} />
        <button type="button" className="icon-button" aria-label={`删除第 ${i + 1} 节`} disabled={rows.length < 2} onClick={() => setRows(l => l.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
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
