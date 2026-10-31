import type { ReadingCollection } from './core';
export const SAVED_COLLECTIONS_KEY = 'typikon.saved-reading-collections.v1';
export interface SavedCollection extends ReadingCollection {
    savedAt: string;
    failed: string[];
}
export function readSavedCollections(storage: Pick<Storage, 'getItem'> = localStorage): SavedCollection[] {
    const value = JSON.parse(storage.getItem(SAVED_COLLECTIONS_KEY) || '[]');
    if (!Array.isArray(value))
        throw Error('Список сохранённых подборок повреждён.');
    return value.filter((row: any) => row && typeof row.id === 'string' && typeof row.title === 'string' && Array.isArray(row.items) && row.items.length <= 200 && row.items.every((i: any) => typeof i.title === 'string' && typeof i.href === 'string' && /^\/reading\/[^/?#\s]+(?:\?statia=\d+)?$/.test(i.href)));
}
export function saveCollectionSnapshot(row: ReadingCollection, failed: string[], storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
    const rows = readSavedCollections(storage).filter(r => r.id !== row.id);
    rows.push({ ...row, savedAt: new Date().toISOString(), failed });
    storage.setItem(SAVED_COLLECTIONS_KEY, JSON.stringify(rows));
}
export function removeCollectionSnapshot(id: string, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) { storage.setItem(SAVED_COLLECTIONS_KEY, JSON.stringify(readSavedCollections(storage).filter(r => r.id !== id))); }
