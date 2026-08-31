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
    { code: "zh", label: "КИТ" },
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

/**
 * Короткий ярлык языка. Незнакомый код не прячем и не заменяем на «ЦС»: издание
 * могли завести раньше, чем дописали его сюда, и молчаливая подстановка чужого
 * ярлыка врала бы ровно там, где важнее всего сказать правду.
 */
export const bibleLanguageShort = (code: string): string =>
    BIBLE_LANGUAGE_OPTIONS.find((option) => option.code === code)?.label ?? code.toUpperCase();

/**
 * Чем чтение отдано, если не тем, что просили.
 *
 * ЗАЧЕМ ЭТО ВИДНО ЧИТАТЕЛЮ. Резолюция зачал давно умеет откатываться на
 * церковнославянский, когда на выбранном языке чтения не собрать, и записывает
 * в `resolvedLang`, чем отдала на самом деле. Но поле доходило только до API, а
 * на странице подмена была не видна вовсе. Пока все издания были полными
 * Библиями, откат почти не случался; с частичным переводом — одним
 * Четвероевангелием — он пойдёт на каждой второй службе, и читатель, выбравший
 * китайский, молча получал бы славянский, не понимая, почему.
 *
 * Возвращает null, когда подменять не пришлось, — и тогда показывать нечего.
 */
export const bibleLanguageSubstitution = (
    requested: string | null | undefined,
    resolved: string | null | undefined,
): string | null => {
    if (!requested || !resolved || requested === resolved) return null;
    return `${bibleLanguageShort(resolved)} вместо ${bibleLanguageShort(requested)}: ` +
           "на выбранном языке этого чтения нет";
};
