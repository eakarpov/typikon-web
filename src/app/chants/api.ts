import {
    chantFacets, searchChants, MIN_QUERY_LENGTH,
    type ChantFacets, type ChantFilters, type ChantHit,
} from "@/lib/chants";

export const PAGE_SIZE = 25;

/**
 * error различает три разных «ничего не показано», и путать их нельзя:
 * corpus-missing — файла корпуса на сервере нет вовсе;
 * too-short — запрос набран, но короче трёх букв;
 * null — либо ещё ничего не спрашивали, либо спросили и не нашлось.
 */
export interface ChantsPageData {
    items: ChantHit[];
    total: number;
    facets: ChantFacets | null;
    error: "corpus-missing" | "too-short" | null;
}

const numeric = (raw: string | undefined): number | null => {
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
};

export const filtersFrom = (params: Record<string, string | undefined>): ChantFilters => ({
    source: params.source || null,
    book: params.book || null,
    month: numeric(params.month),
    day: numeric(params.day),
    tone: numeric(params.tone),
    sign: params.sign || null,
    service: params.service || null,
    unit: params.unit || null,
    memoryId: params.memory || null,
    language: params.language || null,
});

/**
 * Выборка страницы. Списки для фильтров берём всегда, даже когда запроса ещё
 * нет: форму надо показать заполненной сразу, а не после первого поиска.
 */
export const chantsData = (params: Record<string, string | undefined>): ChantsPageData => {
    const facets = chantFacets();
    const query = (params.q || "").trim();

    if (!facets) {
        return { items: [], total: 0, facets: null, error: "corpus-missing" };
    }
    if (query.length < MIN_QUERY_LENGTH) {
        return { items: [], total: 0, facets, error: query ? "too-short" : null };
    }

    const page = Math.max(1, numeric(params.page) || 1);
    const found = searchChants(query, filtersFrom(params), PAGE_SIZE, (page - 1) * PAGE_SIZE);

    return {
        items: found?.items ?? [],
        total: found?.total ?? 0,
        facets,
        error: null,
    };
};
