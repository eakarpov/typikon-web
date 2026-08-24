// Разбор параметров списка. Пределы жёсткие: публичная ручка не должна по одному
// запросу отдавать весь корпус — на это есть постраничный обход.
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export interface Page {
    limit: number;
    offset: number;
}

export const readPage = (url: URL): Page => {
    const rawLimit = Number(url.searchParams.get("limit"));
    const rawOffset = Number(url.searchParams.get("offset"));

    return {
        limit: Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT,
        offset: Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0,
    };
};

/** Значение параметра, если оно из списка допустимых. */
export const readEnum = (url: URL, name: string, allowed: readonly string[]): string | null => {
    const value = url.searchParams.get(name);
    return value && allowed.includes(value) ? value : null;
};

export const readDate = (url: URL, name: string): Date | null => {
    const value = url.searchParams.get(name);
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
};
