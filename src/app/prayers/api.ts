import {
    listPrayers, prayerFacets,
    type PrayerFacets, type PrayerFilters, type PrayerRow,
} from "@/lib/prayers";

export const PAGE_SIZE = 25;

/**
 * Пустой запрос — начало просмотра, а не ошибка: как у канонов и акафистов,
 * список сам по себе и есть содержимое раздела. Поиск его сужает.
 */
export interface PrayersPageData {
    items: PrayerRow[];
    total: number;
    facets: PrayerFacets | null;
    corpusMissing: boolean;
}

const numeric = (raw: string | undefined): number | null => {
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
};

export const filtersFrom = (params: Record<string, string | undefined>): PrayerFilters => ({
    q: params.q || null,
    kind: params.kind || null,
});

export const prayersData = (params: Record<string, string | undefined>): PrayersPageData => {
    const facets = prayerFacets();
    if (!facets) {
        return { items: [], total: 0, facets: null, corpusMissing: true };
    }
    const page = Math.max(1, numeric(params.page) || 1);
    const found = listPrayers(filtersFrom(params), PAGE_SIZE, (page - 1) * PAGE_SIZE);
    return {
        items: found?.items ?? [],
        total: found?.total ?? 0,
        facets,
        corpusMissing: false,
    };
};
