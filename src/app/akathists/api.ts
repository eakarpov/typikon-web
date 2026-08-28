import {
    akathistFacets, listAkathists,
    type AkathistFacets, type AkathistFilters, type AkathistRow,
} from "@/lib/akathists";

export const PAGE_SIZE = 25;

export interface AkathistsPageData {
    items: AkathistRow[];
    total: number;
    facets: AkathistFacets | null;
    corpusMissing: boolean;
}

const numeric = (raw: string | undefined): number | null => {
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
};

export const filtersFrom = (params: Record<string, string | undefined>): AkathistFilters => ({
    q: params.q || null,
    subjectKind: params.subject || null,
    status: params.status || null,
});

export const akathistsData = (params: Record<string, string | undefined>): AkathistsPageData => {
    const facets = akathistFacets();
    if (!facets) {
        return { items: [], total: 0, facets: null, corpusMissing: true };
    }
    const page = Math.max(1, numeric(params.page) || 1);
    const found = listAkathists(filtersFrom(params), PAGE_SIZE, (page - 1) * PAGE_SIZE);
    return {
        items: found?.items ?? [],
        total: found?.total ?? 0,
        facets,
        corpusMissing: false,
    };
};
