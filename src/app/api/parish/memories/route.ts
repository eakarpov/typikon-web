import { NextResponse } from 'next/server';
import { getMemoryRows } from '@/lib/memories';
export async function GET(request: Request) {
    const p = new URL(request.url).searchParams, q = (p.get('q') ?? '').trim().toLocaleLowerCase('ru').replaceAll('ё', 'е'), month = Number(p.get('month')), day = Number(p.get('day'));
    if (q.length > 100 || (!q && !month && !day))
        return NextResponse.json([]);
    const rows = (await getMemoryRows()).filter(m => ['menaion', 'triod-postnaya', 'triod-tsvetnaya'].includes(m.book) && (!q || m.label.toLocaleLowerCase('ru').replaceAll('ё', 'е').includes(q)) && (!month || m.month === month) && (!day || m.day === day)).slice(0, 100);
    return NextResponse.json(rows.map(m => ({ memoryId: m.memoryId, label: m.label, month: m.month, day: m.day, sign: m.sign?.default ?? null })), { headers: { 'Cache-Control': 'private, max-age=300' } });
}
