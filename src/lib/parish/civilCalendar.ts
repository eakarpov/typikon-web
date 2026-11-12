/** Годовой производственный календарь isDayOff: переносы рабочих дней
 * учитываются в ответе API, сокращённый день остаётся рабочим. */
export function parseCivilYear(year: number, body: string): Record<string, boolean> {
    const length = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
    if (body.length !== length || !/^[0124]+$/.test(body))
        throw Error('Неполный производственный календарь');
    return Object.fromEntries([...body].map((status, i) => [new Date(Date.UTC(year, 0, 1 + i)).toISOString().slice(0, 10), status === '1']));
}
const failedUntil = new Map<string, number>();
const years = new Map<string, {
    at: number;
    data: Record<string, boolean>;
}>(), pending = new Map<string, Promise<Record<string, boolean> | null>>();
export async function civilYear(country: string, year: number): Promise<Record<string, boolean> | null> {
    if (!/^[A-Z]{2}$/.test(country))
        return null;
    const key = country + year, cached = years.get(key);
    if (cached && Date.now() - cached.at < 86400000)
        return cached.data;
    if ((failedUntil.get(key) ?? 0) > Date.now())
        return cached?.data ?? null;
    if (pending.has(key))
        return pending.get(key)!;
    const task = (async () => {
        try {
            const response = await fetch(`https://isdayoff.ru/api/getdata?year=${year}&cc=${country.toLowerCase()}&pre=1`, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
            if (!response.ok)
                throw Error('calendar unavailable');
            const data = parseCivilYear(year, (await response.text()).trim());
            years.set(key, { at: Date.now(), data });
            failedUntil.delete(key);
            if (years.size > 24)
                years.delete(years.keys().next().value!);
            return data;
        }
        catch {
            failedUntil.set(key, Date.now() + 300000);
            if (failedUntil.size > 24)
                failedUntil.delete(failedUntil.keys().next().value!);
            return cached?.data ?? null;
        }
    })();
    pending.set(key, task);
    try {
        return await task;
    }
    finally {
        pending.delete(key);
    }
}
