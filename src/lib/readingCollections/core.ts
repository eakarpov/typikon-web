export interface ReadingRef {
    textId: string;
    statia?: number;
}
export interface CollectionItem extends ReadingRef {
    title: string;
    href: string;
}
export interface ReadingCollection {
    id: string;
    revision: number;
    title: string;
    items: CollectionItem[];
}
export class CollectionError extends Error {
}
export function collectionTitle(raw: unknown): string { if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > 120)
    throw new CollectionError('Название должно содержать от 1 до 120 символов.'); return raw.trim(); }
export function collectionRefs(raw: unknown): ReadingRef[] {
    if (!Array.isArray(raw) || raw.length > 200)
        throw new CollectionError('В подборке может быть до 200 чтений.');
    return raw.map(item => { if (!item || typeof item !== 'object' || typeof item.textId !== 'string' || !/^[a-f0-9]{24}$/i.test(item.textId) || item.statia !== undefined && (!Number.isInteger(item.statia) || item.statia < 1 || item.statia > 1000))
        throw new CollectionError('Некорректное чтение или статия.'); return { textId: item.textId.toLowerCase(), ...(item.statia !== undefined ? { statia: item.statia } : {}) }; });
}
