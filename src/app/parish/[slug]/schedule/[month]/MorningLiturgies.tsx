'use client';
import { useRouter } from 'next/navigation';
import { parishMutation } from '@/lib/parish/client';
import type { ParishDay } from '@/lib/parish/types';
import { useParishWrite } from './useParishWrite';
export default function MorningLiturgies({ slug, period, day }: {
    slug: string;
    period: string;
    day: ParishDay;
}) {
    const router = useRouter(), { pending, error, run } = useParishWrite();
    const mode = day.dayConfig?.morningService ?? (day.dayConfig?.morningLiturgies ? 'liturgy' : '');
    const save = (morningService: string, morningLiturgies: number | null) => void run(async () => { await parishMutation('/api/parish/' + slug + '/day', 'POST', { period, date: day.date, memories: day.dayConfig?.memories ?? [], sign: day.dayConfig?.sign ?? null, morningService: morningService || null, morningLiturgies }); router.refresh(); });
    return <div className="font-serif text-sm my-2 space-y-2"><label className="block">Утром <select className="border rounded p-1" disabled={pending} value={mode} onChange={e => save(e.target.value, e.target.value === 'liturgy' ? day.dayConfig?.morningLiturgies ?? null : null)}><option value="">По уставу</option><option value="liturgy">Литургия</option><option value="typica">Изобразительны</option></select></label>
 {mode !== 'typica' && <label className="block">Литургий утром <select className="border rounded p-1" disabled={pending} value={day.dayConfig?.morningLiturgies ?? ''} onChange={e => save(e.target.value ? 'liturgy' : mode, e.target.value ? Number(e.target.value) : null)}><option value="">По постоянным настройкам ({day.defaultMorningLiturgies ?? 1})</option>{[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}</select></label>}
 <p className="text-xs text-slate-500">Если Литургия не положена, можно выбрать службу с изобразительными.</p>
 {error && <p role="alert" className="text-red-800">{error}</p>}</div>;
}
