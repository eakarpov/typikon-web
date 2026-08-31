// Выбор языка Библии для резолюции зачал — постоянная настройка пользователя,
// хранится в cookie (не привязана к профилю, работает и для анонимных посетителей).
// По умолчанию — церковнославянский; он же используется как фолбек, если для
// выбранного языка нет размеченной книги/стиха.
export const BIBLE_LANGUAGE_COOKIE = "bibleLang";
export const DEFAULT_BIBLE_LANGUAGE = "cs";
export const FALLBACK_BIBLE_LANGUAGE = "cs";

export const BIBLE_LANGUAGE_OPTIONS: Array<{ code: string; label: string }> = [
    { code: "cs", label: "ЦС" },
    { code: "ro", label: "РУМ" },
    { code: "grc", label: "ГРЕЧ" },
    { code: "la", label: "ЛАТ" },
];

export const getClientBibleLanguage = (): string => {
    if (typeof document === "undefined") return DEFAULT_BIBLE_LANGUAGE;
    const match = document.cookie.match(new RegExp(`(?:^|; )${BIBLE_LANGUAGE_COOKIE}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : DEFAULT_BIBLE_LANGUAGE;
};

export const setClientBibleLanguage = (lang: string): void => {
    if (typeof document === "undefined") return;
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${BIBLE_LANGUAGE_COOKIE}=${encodeURIComponent(lang)}; path=/; max-age=${oneYear}; SameSite=Lax`;
};
