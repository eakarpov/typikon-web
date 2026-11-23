import { DEFAULT_BOOK_LANGUAGE, bookLanguageLabel } from "./bookLanguages";

export interface LibraryBook {
    id: string;
    alias?: string;
    name: string;
    author?: string;
    description?: string;
    language?: string;
    category?: string;
    bibleCode?: string;
    /** Общий устойчивый ключ произведения; не номер текста и не название. */
    workKey?: string;
    editionTitle?: string;
    updatedAt?: string;
}

export const BOOK_CATEGORIES: Record<string, string> = {
    bible: "Библия",
    liturgical: "Богослужебная",
    patristic: "Святоотеческая",
    encyclopedic: "Энциклопедическая",
    historical: "Историческая",
    hagiographic: "Житийная",
};

export const bookCategoryLabel = (category?: string | null): string =>
    category ? BOOK_CATEGORIES[category] || category : "Не указана";

export const BOOK_SCRIPTS: Record<string, string> = {
    civil: "Гражданское",
    church: "Церковное",
    cyrillic: "Кириллица",
    latin: "Латиница",
    greek: "Греческое",
    chinese: "Китайское",
    georgian: "Грузинское",
    arabic: "Арабское",
    unknown: "Не указано",
};

const PRESENTATION: Record<string, [string, string, string]> = {
    cu_gr: ["cu", "Церковнославянский", "civil"],
    cu: ["cu", "Церковнославянский", "church"],
    ru_cu: ["ru", "Русский", "church"],
    orv: ["orv", "Древнерусский", "civil"],
    ru: ["ru", "Русский", "civil"],
    ro_cyr: ["ro", "Румынский", "cyrillic"],
    ro: ["ro", "Румынский", "latin"],
    cv: ["cv", "Чувашский", "civil"],
    cv_cu: ["cv", "Чувашский", "church"],
    grc: ["grc", "Греческий", "greek"],
    la: ["la", "Латинский", "latin"],
    en: ["en", "Английский", "latin"],
    et: ["et", "Эстонский", "latin"],
    ar: ["ar", "Арабский", "arabic"],
    zh: ["zh", "Китайский", "chinese"],
    ka: ["ka", "Грузинский", "georgian"],
};

/** Старые книги без поля используют тот же язык по умолчанию, что редактор. */
export function bookPresentation(language?: string | null) {
    const code = language || DEFAULT_BOOK_LANGUAGE;
    const [lang, label, script] = PRESENTATION[code] || [code, bookLanguageLabel(code), "unknown"];
    return { lang, label, script, scriptLabel: BOOK_SCRIPTS[script] };
}

export interface LibraryFilters {
    lang?: string;
    script?: string;
    work?: string;
    category?: string;
    q?: string;
}

export const LIBRARY_SORT_OPTIONS = {
    name: "По названию, от А до Я",
    "name-desc": "По названию, от Я до А",
    updated: "Сначала недавно обновлённые",
    "updated-asc": "Сначала давно обновлённые",
} as const;

export type LibrarySort = keyof typeof LIBRARY_SORT_OPTIONS;
export type LibraryQuery = LibraryFilters & { sort: LibrarySort; page: number };
export const LIBRARY_PAGE_SIZE = 30;

const searchName = (value: string) => value.normalize("NFD").replace(/[\u0300\u0301]/g, "")
    .normalize("NFC").toLocaleLowerCase("ru").replaceAll("ё", "е").replace(/\s+/g, " ").trim();

export function filterLibraryBooks(books: LibraryBook[], filters: LibraryFilters) {
    const q = searchName(filters.q ?? "");
    return books.filter(book => {
        const info = bookPresentation(book.language);
        return (!filters.lang || filters.lang === info.lang)
            && (!filters.script || filters.script === info.script)
            && (!filters.work || filters.work === book.workKey)
            && (!filters.category || filters.category === (book.category || "uncategorized"))
            && (!q || searchName(book.name ?? "").includes(q));
    });
}

export function readLibraryQuery(params: Record<string, string | string[] | undefined>): LibraryQuery {
    const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
    const sort = first(params.sort);
    const rawPage = first(params.page) ?? "";
    const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
    return {
        q: first(params.q)?.slice(0, 120).trim(),
        lang: first(params.lang),
        script: first(params.script),
        work: first(params.work),
        category: first(params.category),
        sort: sort && Object.hasOwn(LIBRARY_SORT_OPTIONS, sort) ? sort as LibrarySort : "name",
        page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    };
}

export const libraryHref = ({ q, lang, script, work, category, sort, page }: LibraryQuery) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (lang) params.set("lang", lang);
    if (script) params.set("script", script);
    if (work) params.set("work", work);
    if (category) params.set("category", category);
    if (sort !== "name") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    return params.size ? `/library?${params}` : "/library";
};

const names = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });

export function paginateLibraryBooks(books: LibraryBook[], query: LibraryQuery) {
    const matches = filterLibraryBooks(books, query);
    const byDate = query.sort === "updated" || query.sort === "updated-asc";
    const dates = byDate ? new Map(matches.map(book => [book.id, Date.parse(book.updatedAt ?? "")])) : null;
    matches.sort((a, b) => {
        if (dates) {
            const aTime = dates.get(a.id) ?? NaN;
            const bTime = dates.get(b.id) ?? NaN;
            if (Number.isNaN(aTime) !== Number.isNaN(bTime)) return Number.isNaN(aTime) ? 1 : -1;
            if (!Number.isNaN(aTime) && aTime !== bTime) {
                return query.sort === "updated" ? bTime - aTime : aTime - bTime;
            }
        }
        const byName = names.compare(a.name ?? "", b.name ?? "");
        return (query.sort === "name-desc" ? -byName : byName) || a.id.localeCompare(b.id);
    });
    const total = matches.length;
    const pages = Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE));
    const page = Math.min(query.page, pages);
    const offset = (page - 1) * LIBRARY_PAGE_SIZE;
    return { books: matches.slice(offset, offset + LIBRARY_PAGE_SIZE), total, page, pages, offset };
}

export const libraryBookHref = (book: LibraryBook): string => book.bibleCode
    ? `/bible?v=${encodeURIComponent(book.bibleCode)}`
    : `/library/${encodeURIComponent(book.alias || book.id)}`;
