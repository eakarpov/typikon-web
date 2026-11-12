import { NextResponse } from 'next/server';
import { getMemoryRows } from '@/lib/memories';
export async function GET(request: Request) {
    const plain=(value:string)=>value.toLocaleLowerCase('ru').replaceAll('ё','е').normalize('NFD').replace(/[\u0300\u0301\u0342]/g,'').normalize('NFC');
    const p = new URL(request.url).searchParams, q = plain((p.get('q') ?? '').trim()), month = Number(p.get('month')), day = Number(p.get('day'));
    if (q.length > 100 || (!q && !month && !day))
        return NextResponse.json([]);
    const rows = (await getMemoryRows()).filter(m => ['menaion', 'triod-postnaya', 'triod-tsvetnaya'].includes(m.book) && (!q || plain(m.label).includes(q)) && (!month || m.month === month) && (!day || m.day === day)).slice(0, 100);
    return NextResponse.json(rows.map(m => ({ memoryId: m.memoryId, label: m.label, month: m.month, day: m.day, sign: m.sign?.default ?? null })), { headers: { 'Cache-Control': 'private, max-age=300' } });
}
