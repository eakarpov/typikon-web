import clientPromise from '@/lib/mongodb';
import { dneslovAddress, loadDneslovCard } from './dneslovIdentity';
import { cachedDneslov, allDneslovPages, type SnapshotStore } from './dneslovCache';

const DAY = 86400000;
export const dneslovSnapshots: SnapshotStore = {
    async read(key) {
        const db = (await clientPromise).db('typikon');
        const row: any = await db.collection('dneslov_http_cache').findOne({ _id: key as any });
        return row?.data && row.fetchedAt ? { data: row.data, fetchedAt: row.fetchedAt } : null;
    },
    async write(key, data, fetchedAt) {
        const db = (await clientPromise).db('typikon');
        await db.collection('dneslov_http_cache').updateOne({ _id: key as any },
            { $set: { data, fetchedAt } }, { upsert: true });
    },
};

export async function fetchDneslovJson(path: string): Promise<any> {
    let last: unknown;
    for (const scheme of ['https', 'http']) {
        try {
            const response = await fetch(`${scheme}://dneslov.org${path}`, {
                signal: AbortSignal.timeout(3000), cache: 'no-store',
            });
            if (!response.ok) throw new Error(`Днеслов: HTTP ${response.status}`);
            return await response.json();
        } catch (e) { last = e; }
    }
    throw last;
}

/** Сохраняем новые внешние памяти отдельно от отредактированного нами каталога. */
async function rememberDayMemories(rows: any[]) {
    const db = (await clientPromise).db('typikon');
    const unique = new Map(rows.map(r => [dneslovAddress(r), r] as const).filter(([id]) => id != null));
    if (!unique.size) return;
    await db.collection('dneslov_memories').bulkWrite([...unique].map(([id, row]) => ({
        updateOne: {
            filter: { _id: id as any },
            update: {
                $set: { calendarMemory: row, ...(row.slug ? { slug: row.slug } : {}), calendarFetchedAt: new Date() },
                // fetchedAt относится к ПОЛНОЙ карточке, а не дневному оглавлению.
                $setOnInsert: { memory: row, fetchedAt: null, status: 'partial' },
            },
            upsert: true,
        },
    })));
}

export async function dneslovDay(date: string) {
    return cachedDneslov(`calendar:v1:${date}`, DAY, async () => {
        const calendars = await cachedDneslov('calendaries:v1', 7 * DAY,
            () => allDneslovPages('/calendaries.json?l=true', fetchDneslovJson), dneslovSnapshots);
        if (!calendars.data) throw new Error('Днеслов: нет списка календарей');
        const slugs = [...new Set(calendars.data.map((c: any) => typeof c.slug === 'string' ? c.slug : c.slug?.text).filter(Boolean))];
        if (!slugs.length) throw new Error('Днеслов: пустой список календарей');
        const day = new Date(`${date}T00:00:00Z`);
        day.setUTCDate(day.getUTCDate() - 13);
        const julian = `${String(day.getUTCDate()).padStart(2,'0')}.${String(day.getUTCMonth()+1).padStart(2,'0')}.${day.getUTCFullYear()}`;
        const q = new URLSearchParams({ d: `ю${julian}`, c: slugs.join(',') });
        const rows = await allDneslovPages(`/index.json?${q}`, fetchDneslovJson);
        await rememberDayMemories(rows);
        return rows;
    }, dneslovSnapshots);
}

/** Полная карточка также остаётся в Mongo после удачного живого запроса. */
export async function durableDneslovMemory(id: string): Promise<any | null> {
    const db = (await clientPromise).db('typikon');
    const existing: any = await db.collection('dneslov_memories').findOne({ _id: id as any });
    const result = await cachedDneslov(`memory:v2:${id}`, DAY, async () => {
        const hint = existing?.calendarMemory ?? existing?.memory;
        const { memory, details, slug } = await loadDneslovCard(id, hint, fetchDneslovJson);
        const update = { memory, details, slug, status: 'ok', fetchedAt: new Date() };
        const keys = [...new Set([id, String(memory.id), slug])];
        for (const key of keys) await db.collection('dneslov_memories').updateOne(
            { _id: key as any }, { $set: update }, { upsert: true });
        return details;
    }, dneslovSnapshots);
    return result.data ? { ...result.data, _dneslovUnavailable: false }
        : existing?.details ? { ...existing.details, slug: existing.slug, _dneslovUnavailable: true } : null;
}

export async function durableDneslovTitle(id: string): Promise<string | null> {
    const db = (await clientPromise).db('typikon');
    const snapshot: any = await db.collection('dneslov_memories').findOne({ _id: id as any });
    const known = snapshot?.details?.short_name || snapshot?.memory?.short_name || snapshot?.memory?.title || snapshot?.title;
    const refresh = () => cachedDneslov(`title:v1:${id}`, DAY, async () => {
        const memory = await fetchDneslovJson(`/api/v0/memories/${encodeURIComponent(id)}.json`);
        const title = memory?.title || memory?.short_name;
        if (typeof title !== 'string' || !title.trim()) throw new Error('Днеслов: нет названия памяти');
        await db.collection('dneslov_memories').updateOne({ _id: id as any }, {
            $set: { memory, titleFetchedAt: new Date(), ...(memory.slug ? { slug: memory.slug } : {}) },
            $setOnInsert: { fetchedAt: null, status: 'partial' },
        }, { upsert: true });
        return title;
    }, dneslovSnapshots);
    if (typeof known === 'string' && known.trim()) {
        void refresh().catch(() => {});
        return known;
    }
    return (await refresh()).data;
}
