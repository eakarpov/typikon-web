"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parishMutation } from '@/lib/parish/client';
import { timeRowLabel,TIME_ROWS, defaultPractice, slots, type ParishPractice, type TimeKey, type LiturgyCount, type Frequency } from '@/lib/parish/practice';
import { useParishWrite } from '../schedule/[month]/useParishWrite';
const field = 'border rounded bg-white px-2 py-1';
export function Rules({ slug, practice, timezone, zones, calendarAvailable }: {
    slug: string;
    practice: ParishPractice;
    timezone: string;
    zones: string[];
    calendarAvailable: boolean;
}) {
    const router = useRouter(), { pending, error, run } = useParishWrite();
    const [value, setValue] = useState(practice), [tz, setTz] = useState(timezone), [saved, setSaved] = useState('');
    const save = () => run(async () => { await parishMutation('/api/parish/' + slug + '/settings', 'POST', { practice: value, timezone: tz }); setSaved('Настройки сохранены.'); router.refresh(); });
    const update = (next: ParishPractice) => { setSaved(''); setValue(next); };
    const setTime = (key: TimeKey, part: 'morning' | 'evening', time: string) => update({ ...value, times: { ...value.times, [key]: { ...value.times[key], [part]: time } } });
    const visible = (key: TimeKey) => { for (const cat of ['sunday', 'feast', 'patron'] as const)
        if (key.startsWith(cat)) {
            const slot = key.slice(cat.length).toLowerCase();
            return slots(value.liturgies[cat]).includes(slot as ReturnType<typeof slots>[number]);
        } return true; };
    return <form className="font-serif space-y-6" onSubmit={e => { e.preventDefault(); void save(); }}>
 <fieldset disabled={pending} className="space-y-3"><legend className="text-xl font-bold mb-3">Время</legend>
 <div className="flex flex-wrap gap-3"><label>Часовой пояс <select className={field} value={tz} onChange={e => { setTz(e.target.value); setSaved(''); }}>{zones.map(z => <option key={z}>{z}</option>)}</select></label>
 <label>Страна календаря <input className={field + ' w-20'} aria-label="Страна календаря (код ISO)" maxLength={2} placeholder="RU" value={value.country} onChange={e => update({ ...value, country: e.target.value.toUpperCase() })}/></label></div>
 <p className="text-sm text-slate-600">Код страны храма: RU — Россия, BY — Беларусь, KZ — Казахстан и т. д. Гражданские выходные и переносы рабочих дней берём из производственного календаря <a className="underline" href="https://www.isdayoff.ru/db/" target="_blank" rel="noreferrer">isDayOff</a>. Воскресенье всегда использует собственные указания.</p>
 {!calendarAvailable && <p role="status" className="text-amber-800 text-sm">Производственный календарь для сохранённой страны пока недоступен. Временно учитываются только субботы и воскресенья; после загрузки календаря появятся гражданские выходные.</p>}
 <p className="text-sm text-slate-600">«Выходной день» — базовое время для гражданских выходных и суббот. Пустое поле субботы использует это время; в рабочую перенесённую субботу — время буднего дня. Отдельные указания субботы имеют приоритет. Для двух литургий — ранняя и поздняя; для трёх — ранняя, средняя и поздняя. Вечерняя служба одна; её время задаётся в единственном поле «Вечер» соответствующего дня.</p>
 <table className="w-full border-collapse text-sm"><thead><tr><th className="text-left py-2">Вариант дня</th><th>Утро</th><th>Вечер</th></tr></thead><tbody>{TIME_ROWS.filter(([key]) => visible(key)).map(([key, original]) => {const label=timeRowLabel(key,original,value);return (<tr key={key} className="border-t"><th className="text-left font-normal py-2 pr-2">{label}</th>{(['morning', 'evening'] as const).map(part => <td key={part} className="p-1">{part === 'evening' && /Early$|Late$/.test(key) ? <span className="text-slate-400">—</span> : <><input type="time" aria-label={`${label} — ${part === 'morning' ? 'утро' : 'вечер'}`} className={field + ' w-full'} value={value.times[key][part]} required={['weekday', 'weekend'].includes(key)} onChange={e => setTime(key, part, e.target.value)}/>{!value.times[key][part] && <small className="text-slate-500">по базовому времени</small>}</>}</td>)}</tr>);})}</tbody></table>
 </fieldset>
 <fieldset disabled={pending} className="space-y-3"><legend className="text-xl font-bold mb-3">Состав</legend>
 {(['compline', 'midnight'] as const).map(key => <label key={key} className="flex flex-wrap items-center justify-between gap-2">{key === 'compline' ? 'Повечерие' : 'Полунощница'}<select className={field} value={value[key]} onChange={e => update({ ...value, [key]: e.target.value as Frequency })}><option value="always">Есть всегда</option><option value="lent">Есть Великим постом</option><option value="never">Нет</option></select></label>)}
 <label className="flex flex-wrap justify-between gap-2">Уставная панихида<select className={field} value={value.panihida} onChange={e => update({ ...value, panihida: e.target.value as ParishPractice['panihida'] })}><option value="friday-vespers">Пятница после вечерни</option><option value="friday-end">Пятница в конце вечерней службы</option><option value="saturday-liturgy">В субботу после Литургии</option><option value="never">Нет</option></select></label>
 {([['sunday', 'Количество Литургий в воскресенье'], ['patron', 'Количество Литургий на престол'], ['feast', 'Количество Литургий на великие праздники']] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-2">{label}<select className={field} value={value.liturgies[key]} onChange={e => update({ ...value, liturgies: { ...value.liturgies, [key]: Number(e.target.value) as LiturgyCount } })}>{[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}</select></label>)}
 </fieldset>
 {error && <p role="alert" className="text-red-800">{error}</p>}{saved && <p role="status" className="text-green-800">{saved}</p>}
 <div className="flex gap-4"><button disabled={pending} type="submit" className="border rounded bg-amber-50 px-4 py-2">Сохранить настройки</button><button disabled={pending} type="button" className="underline" onClick={() => update(defaultPractice(value.country))}>Заполнить начальными значениями</button></div>
 </form>;
}
