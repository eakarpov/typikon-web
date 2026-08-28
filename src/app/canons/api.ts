import {
    canonFacets, listCanons,
    type CanonFacets, type CanonFilters, type CanonRow,
} from "@/lib/canons";

export const PAGE_SIZE = 25;

/**
 * Пустой запрос здесь — не ошибка, а начало просмотра.
 *
 * Тем раздел и отличается от поиска по песнопениям: там без слова показывать
 * нечего (весь корпус — 94 тысячи строк), а здесь список канонов сам по себе
 * и есть содержимое раздела, все 1646. Поиск его сужает, а не открывает.
 */
export interface CanonsPageData {
    items: CanonRow[];
    total: number;
    facets: CanonFacets | null;
    corpusMissing: boolean;
}

const numeric = (raw: string | undefined): number | null => {
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
};

export const filtersFrom = (params: Record<string, string | undefined>): CanonFilters => ({
    q: params.q || null,
    book: params.book || null,
    tone: numeric(params.tone),
    service: params.service || null,
    role: params.role || null,
});

export const canonsData = (params: Record<string, string | undefined>): CanonsPageData => {
    const facets = canonFacets();
    if (!facets) {
        return { items: [], total: 0, facets: null, corpusMissing: true };
    }
    const page = Math.max(1, numeric(params.page) || 1);
    const found = listCanons(filtersFrom(params), PAGE_SIZE, (page - 1) * PAGE_SIZE);
    return {
        items: found?.items ?? [],
        total: found?.total ?? 0,
        facets,
        corpusMissing: false,
    };
};
