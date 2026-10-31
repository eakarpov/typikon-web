'use client';
import PlanReminderSettings from './PlanReminderSettings';
import type {PlanReminder} from '@/lib/readingPlan/reminders';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ReadingPlan } from '@/lib/readingPlan/core';
import DayPartReading from '@/app/components/DayPartReading';
import { TextType } from '@/utils/texts';
const button = 'min-h-11 rounded border px-3 py-2 disabled:opacity-50';
export default function PlanManager({ compact = false }: {
    compact?: boolean;
}) {
    const [plan, setPlan] = useState<ReadingPlan | null>(null), [loaded, setLoaded] = useState(false), [login, setLogin] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const [books, setBooks] = useState<{
        id: string;
        name: string;
    }[]>([]), [kind, setKind] = useState('lectionary'), [book, setBook] = useState(''), [date, setDate] = useState('');
    useEffect(() => { setDate(new Date().toLocaleDateString('sv-SE')); let active = true; fetch('/api/reading-plan', { cache: 'no-store' }).then(async (r) => { if (r.status === 401) {
        if (active)
            setLogin(true);
        return null;
    } if (!r.ok)
        throw Error('Не удалось загрузить план.'); return r.json(); }).then(p => { if (active) {
        setPlan(p);
        setLoaded(true);
    } }).catch(e => { if (active) {
        setError(e.message);
        setLoaded(true);
    } }); return () => { active = false; }; }, []);
    useEffect(() => { if (!loaded || compact || login)
        return; fetch('/api/reading-plan?options=1', { cache: 'no-store' }).then(r => { if (!r.ok)
        throw Error('Не удалось загрузить книги.'); return r.json(); }).then(setBooks).catch(e => setError(e.message)); }, [loaded, compact, login]);
    async function change(method: string, action?: string, reminder?:PlanReminder) { setBusy(true); setError(''); try {
        const r = await fetch('/api/reading-plan', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(method === 'POST' ? { kind, bookId: book, date } : { id: plan?.id, revision: plan?.revision, action, ...(reminder?{reminder}:{}) }) });
        const p = await r.json().catch(() => null);
        if (!r.ok)
            throw Error(p?.error || 'Не удалось сохранить план.');
        setPlan(p);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    }
    finally {
        setBusy(false);
    } }
    if (!loaded)
        return <p role="status">Загружаю план…</p>;
    if (login)
        return <p><Link href="/login" className="underline">Войдите</Link>, чтобы сохранить личный план чтения.</p>;
    if (compact && !plan)
        return <Link href="/reading-plan" className="underline">Составить личный план чтения</Link>;
    const unit = plan?.units[plan.cursor];
    return <section className="space-y-3 max-w-3xl font-serif" aria-label="Личный план чтения">
 {error && <p role="alert">{error}</p>}
 {plan ? <><h2 className="font-bold">Личный план: {plan.title}</h2><p>{plan.kind === 'lectionary' ? `Ряд на ${plan.date}${plan.units.length ? ` · чтение ${plan.cursor + 1} из ${plan.units.length}` : ""}` : `Прочитано ${Math.min(plan.cursor, plan.units.length)} из ${plan.units.length}`}</p>
 <p>{plan.status === 'paused' ? 'План приостановлен.' : plan.status === 'completed' ? 'План завершён.' : 'Пропущенные дни не накапливаются. Следующий шаг — после вашей отметки.'}</p>
 {unit && plan.status !== 'completed' && <Link className="underline block" href={unit.href}>{unit.title}</Link>}
 {!compact && unit?.pericope && <div id="plan-current-reading"><DayPartReading value={{ items: [{ pericope: unit.pericope }] }} valueName={unit.slot as TextType}/></div>}
 {!unit && plan.kind === 'lectionary' && plan.status !== 'completed' && <p>На эту дату в подвижном круге рядовых литургийных чтений нет.</p>}
 <div className="flex gap-2 flex-wrap">
 {plan.status === 'active' && <><button disabled={busy} className={button} onClick={() => change('PATCH', 'advance')}>{unit ? 'Прочитано' : 'Перейти к следующему дню'}</button><button disabled={busy} className={button} onClick={() => change('PATCH', 'pause')}>Приостановить</button></>}
 {plan.status === 'paused' && <button disabled={busy} className={button} onClick={() => change('PATCH', 'resume')}>Возобновить</button>}
 {compact ? <Link className={button} href="/reading-plan">Открыть план</Link> : <button disabled={busy} className={button} onClick={() => { if (window.confirm('Удалить этот план? Место чтения текстов сохранится.'))
            void change('DELETE'); }}>Удалить план</button>}
 </div>{!compact&&<PlanReminderSettings plan={plan} busy={busy} onSave={r=>change('PATCH','reminder',r)}/>}</> : <form className="space-y-3" onSubmit={e => { e.preventDefault(); void change('POST'); }}>
 <p>Один личный план: рядовые Апостол и Евангелие из подвижного круга либо последовательное чтение книги. Назначения праздников смотрите отдельно в чтениях дня.</p>
 <label className="block">Вид плана<select className="block border p-2 max-w-full" value={kind} onChange={e => setKind(e.target.value)}><option value="lectionary">По рядовым зачалам</option><option value="book">По книге</option></select></label>
 {kind === 'book' && <label className="block">Книга<select required className="block border p-2 max-w-full" value={book} onChange={e => setBook(e.target.value)}><option value="">Выберите книгу</option>{books.map(b => <option value={b.id} key={b.id}>{b.name}</option>)}</select></label>}
 {kind === 'lectionary' && <label className="block">Начать ряд с даты<input required className="block border p-2" type="date" min="1900-01-01" max="2099-12-31" value={date} onChange={e => setDate(e.target.value)}/></label>}
 <button className={button} disabled={busy}>Начать план</button></form>}
 </section>;
}
