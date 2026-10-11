'use client';
/** Searchable 授课老师 select: teachers from 系统管理 · 授课老师 plus ops staff (运营老师也授课). No free text. */
import { useId, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, UserRound } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { useNexus } from '@/lib/nexus/store';
import { canManageSystem } from '@/lib/nexus/roles';

export function TeacherPicker({ value, onChange, label = '授课老师', allowEmpty = true }: { value: string; onChange: (name: string) => void; label?: string; allowEmpty?: boolean }) {
  const s = useNexus();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const staffNames = useMemo(() => new Set(s.staff.filter(u => u.active).map(u => u.name)), [s.staff]);
  const ops = [...staffNames];
  const others = useMemo(() => {
    const out: string[] = [];
    for (const t of s.teachers) if (t.active && !staffNames.has(t.name) && !out.includes(t.name)) out.push(t.name);
    if (value && !staffNames.has(value) && !out.includes(value)) out.push(value);
    return out;
  }, [s.teachers, staffNames, value]);
  const pick = (v: string) => { onChange(v); setOpen(false); };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" role="combobox" aria-expanded={open} aria-controls={listId} aria-label={label} className={'choice teacher-picker' + (value ? '' : ' empty')}>
        <UserRound size={15} aria-hidden="true" /><span>{value || '选择授课老师'}</span><ChevronsUpDown size={15} className="teacher-picker-caret" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent id={listId} className="teacher-picker-pop" align="start">
      <Command filter={(item, search) => item.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0}>
        <CommandInput placeholder="搜索老师姓名…" />
        <CommandList>
          <CommandEmpty>没有找到这位老师{canManageSystem(s.role) ? '，可在系统管理 · 授课老师中添加' : '，请联系超级管理员添加'}</CommandEmpty>
          {allowEmpty && <CommandGroup><CommandItem value="未指定" onSelect={() => pick('')}><Check size={14} className={value ? 'invisible' : ''} />未指定</CommandItem></CommandGroup>}
          {ops.length > 0 && <CommandGroup heading="运营老师">{ops.map(n => <CommandItem key={'o-' + n} value={n} onSelect={() => pick(n)}><Check size={14} className={value === n ? '' : 'invisible'} />{n}</CommandItem>)}</CommandGroup>}
          {others.length > 0 && <CommandGroup heading="授课老师">{others.map(n => <CommandItem key={'t-' + n} value={n} onSelect={() => pick(n)}><Check size={14} className={value === n ? '' : 'invisible'} />{n}</CommandItem>)}</CommandGroup>}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
