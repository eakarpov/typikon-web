'use client';
import { useEffect, useState } from 'react';
import type { ReadingPlan } from '@/lib/readingPlan/core';
import type { PlanReminder } from '@/lib/readingPlan/reminders';
export default function PlanReminderSettings({ plan, busy, onSave }: {
    plan: ReadingPlan & {
        reminderDevices?: number;
    };
    busy: boolean;
    onSave: (r: PlanReminder) => Promise<void>;
}) {
    const [enabled, setEnabled] = useState(false), [time, setTime] = useState('08:00'), [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]), [zone, setZone] = useState('Europe/Moscow');
    useEffect(() => { const r = plan.reminder; setEnabled(r?.enabled ?? false); setTime(r?.time ?? '08:00'); setDays(r?.weekdays ?? [1, 2, 3, 4, 5, 6, 7]); setZone(r?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone); }, [plan.id, plan.reminder]);
    return <form className="border rounded p-3 space-y-3" onSubmit={e => { e.preventDefault(); void onSave({ enabled, time, weekdays: days, timeZone: zone }); }}><h3 className="font-bold">Напоминания в приложении</h3><label className="flex gap-2 items-center min-h-11"><input type="checkbox" checked={enabled} disabled={busy || plan.status === 'completed'} onChange={e => setEnabled(e.target.checked)}/>Напоминать об очередном чтении</label><label className="block">Время<input className="block border p-2" type="time" required value={time} disabled={busy} onChange={e => setTime(e.target.value)}/></label><fieldset><legend>Дни недели</legend><div className="flex flex-wrap gap-2">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, i) => <label key={d} className="border rounded p-2 min-h-11"><input type="checkbox" checked={days.includes(i + 1)} disabled={busy} onChange={e => setDays(v => e.target.checked ? [...v, i + 1] : v.filter(n => n !== i + 1))}/>{' '}{d}</label>)}</div></fieldset><label className="block">Часовой пояс<input required className="block border p-2 max-w-full" value={zone} disabled={busy} onChange={e => setZone(e.target.value)} placeholder="Europe/Moscow"/></label><p className="text-sm">Пояс используется для выбранного времени и дней недели. Уведомление ведёт к текущему чтению; пропуски не накапливаются.</p>{plan.status === 'paused' && <p>План на паузе: уведомления не отправляются. После возобновления действует сохранённое расписание.</p>}{!plan.reminderDevices && <p>Телефон ещё не подключён. Откройте личный план в обновлённом приложении и подключите уведомления на этом телефоне.</p>}<button className="min-h-11 border rounded p-2 disabled:opacity-50" disabled={busy || enabled && !days.length}>Сохранить напоминания</button></form>;
}
