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
    return <div className="font-serif text-sm my-2"><label>Литургий утром <select className="border rounded p-1" disabled={pending} value={day.dayConfig?.morningLiturgies ?? ''} onChange={e => { const count = e.target.value ? Number(e.target.value) : null; void run(async () => { await parishMutation('/api/parish/' + slug + '/day', 'POST', { period, date: day.date, memories: day.dayConfig?.memories ?? [], sign: day.dayConfig?.sign ?? null, morningLiturgies: count }); router.refresh(); }); }}><option value="">По постоянным настройкам ({day.defaultMorningLiturgies ?? 1})</option>{[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}</select></label>{error && <p role="alert" className="text-red-800">{error}</p>}</div>;
}
