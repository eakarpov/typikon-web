import {
    alphabetOf, incipitFacets, listIncipits, normalizeIncipitQuery,
    type IncipitFacets, type IncipitFilters, type IncipitRow, type IncipitSort,
} from "@/lib/incipits";
import { DEFAULT_BOOK_LANGUAGE } from "@/utils/bookLanguages";

export const PAGE_SIZE = 25;

export interface IncipitsPageData {
    items: IncipitRow[];
    total: number;
    facets: IncipitFacets | null;
    /**
     * Буквы, с которых начинаются зачины выбранного языка. Берутся только когда
     * запроса нет: это вход в указатель, а не украшение выдачи.
     */
    alphabet: string[] | null;
    /** Язык, чей алфавит показан. При невыбранном — славянский. */
    alphabetLanguage: string;
    corpusMissing: boolean;
}

export const filtersFrom = (params: Record<string, string | undefined>): IncipitFilters => ({
    language: params.language || null,
    unit: params.unit || null,
    source: params.source || null,
});

const sortFrom = (raw: string | undefined): IncipitSort => (raw === "uses" ? "uses" : "alpha");

/**
 * Выборка страницы.
 *
 * Развилка здесь одна и она содержательная: без запроса показывается буквенный
 * перечень, с запросом — найденное. Списки для фильтров берутся в обоих случаях,
 * чтобы форма была заполнена сразу, а не после первого поиска.
 */
export const incipitsData = (params: Record<string, string | undefined>): IncipitsPageData => {
    const facets = incipitFacets();
    if (!facets) {
        return {
            items: [], total: 0, facets: null, alphabet: null,
            alphabetLanguage: DEFAULT_BOOK_LANGUAGE, corpusMissing: true,
        };
    }

    const language = params.language || DEFAULT_BOOK_LANGUAGE;
    const query = normalizeIncipitQuery(params.q || "");

    if (!query) {
        return {
            items: [], total: 0, facets,
            alphabet: alphabetOf(language),
            alphabetLanguage: language,
            corpusMissing: false,
        };
    }

    const page = Math.max(1, Number(params.page) || 1);
    const found = listIncipits(
        query, filtersFrom(params), sortFrom(params.sort), PAGE_SIZE, (page - 1) * PAGE_SIZE,
    );

    return {
        items: found?.items ?? [],
        total: found?.total ?? 0,
        facets,
        alphabet: null,
        alphabetLanguage: language,
        corpusMissing: false,
    };
};
