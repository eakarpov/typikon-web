'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReadingPlan } from '@/lib/readingPlan/core';
export default function ReadingPlanStep({ textId, statia }: {
    textId: string;
    statia?: number;
}) {
    const [plan, setPlan] = useState<ReadingPlan | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const router = useRouter();
    useEffect(() => { let alive = true; fetch('/api/reading-plan', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(p => { if (alive)
        setPlan(p); }).catch(() => { }); return () => { alive = false; }; }, [textId, statia]);
    const unit = plan?.units[plan.cursor];
    if (!plan || plan.status !== 'active' || unit?.textId !== textId || unit.statia !== statia)
        return null;
    async function advance() { setBusy(true); try {
        const r = await fetch('/api/reading-plan', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: plan!.id, revision: plan!.revision, action: 'advance' }) });
        const p = await r.json();
        if (!r.ok)
            throw Error(p.error || 'Не удалось сохранить отметку.');
        const next = p.units?.[p.cursor];
        router.push(next?.href || '/reading-plan');
        router.refresh();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
    } }
    return <aside className="py-4 space-y-2 no-pdf"><p>Личный план: {plan.title}</p><button className="min-h-11 border rounded p-3" disabled={busy} onClick={advance}>Прочитано — перейти дальше</button>{error && <p role="alert">{error}</p>}</aside>;
}
