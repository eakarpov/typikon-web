/** Долгоживущий кэш только успешных ответов. Ошибка не затирает снимок. */
export interface SuccessSnapshot<T> { data: T; fetchedAt: Date }
export interface SnapshotStore {
    read(key: string): Promise<SuccessSnapshot<any> | null>;
    write(key: string, data: any, fetchedAt: Date): Promise<void>;
}
const inFlight = new Map<string, Promise<SuccessSnapshot<any>>>();
export async function cachedDneslov<T>(key: string, ttlMs: number,
    load: () => Promise<T>, store: SnapshotStore, now = new Date()):
    Promise<{ data: T | null; stale: boolean }> {
    const old = await store.read(key);
    if (old && now.getTime() - new Date(old.fetchedAt).getTime() < ttlMs) {
        return { data: old.data, stale: false };
    }
    const refresh = () => {
        let pending = inFlight.get(key);
        if (!pending) {
            pending = (async () => {
                const data = await load();
                const snapshot = { data, fetchedAt: now };
                await store.write(key, data, now);
                return snapshot;
            })();
            inFlight.set(key, pending);
            void pending.finally(() => inFlight.delete(key)).catch(() => {});
        }
        return pending;
    };
    if (old) {
        // Снимок доступен сразу; догрузка не удерживает страницу при падении источника.
        void refresh().catch(() => {});
        return { data: old.data, stale: true };
    }
    try { return { data: (await refresh()).data, stale: false }; }
    catch { return { data: null, stale: false }; }
}

/** Днеслов отдаёт total элементов, а не страниц. Частичная пачка не годится в кэш. */
export async function allDneslovPages(path: string, fetchJson: (path: string) => Promise<any>): Promise<any[]> {
    const rows: any[] = [];
    let total = Infinity;
    for (let page = 1; page <= 200; page++) {
        const url = new URL(path, 'https://dneslov.org');
        url.searchParams.set('page', String(page));
        url.searchParams.set('per', '100');
        const data = await fetchJson(url.pathname + url.search);
        if (!Array.isArray(data?.list)) throw new Error('Днеслов: в ответе нет list');
        const count = Number(data.total);
        if (!Number.isSafeInteger(count) || count < 0) throw new Error('Днеслов: нет total');
        total = count;
        if (data.list.length === 0 && rows.length < total) throw new Error('Днеслов: неполная пагинация');
        rows.push(...data.list);
        if (rows.length >= total) return rows;
    }
    throw new Error('Днеслов: превышен предел страниц');
}
