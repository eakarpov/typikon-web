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

export function filterLibraryBooks(books: LibraryBook[], filters: { lang?: string; script?: string; work?: string; category?: string }) {
    return books.filter(book => {
        const info = bookPresentation(book.language);
        return (!filters.lang || filters.lang === info.lang)
            && (!filters.script || filters.script === info.script)
            && (!filters.work || filters.work === book.workKey)
            && (!filters.category || filters.category === (book.category || "uncategorized"));
    });
}

export const libraryBookHref = (book: LibraryBook): string => book.bibleCode
    ? `/bible?v=${encodeURIComponent(book.bibleCode)}`
    : `/library/${encodeURIComponent(book.alias || book.id)}`;
