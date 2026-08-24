// Нормализация имён для fuzzy-сопоставления между источниками (Wikidata, dneslov.org, руками
// введённые записи). Убирает уточнения в скобках, ударения (комбинирующие диакритики), регистр,
// ё/е, всё не-буквенно-цифровое.
export const stripDisambiguation = (name: string) => name.replace(/\s*\([^)]*\)\s*/g, " ").trim();

export const normalizeName = (name: string) =>
    stripDisambiguation(name)
        .normalize("NFD")
        // Комбинирующие диакритики (ударения и т.п., включая U+0301) — отдельные code points после NFD.
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^a-zа-я0-9 ]/gi, "")
        .replace(/\s+/g, " ")
        .trim();

// Как normalizeName, но НЕ снимает уточнение в скобках — оно как раз отличает разных тёзок
// ("Иван Фёдорович" vs "Иван Фёдорович (князь стародубский)"), поэтому для проверки "это буквально
// одна и та же строка" скобки терять нельзя.
export const normalizeFull = (name: string) =>
    name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^a-zа-я0-9() ]/gi, "")
        .replace(/\s+/g, " ")
        .trim();

// Проверка "фраза встречается в тексте как отдельное слово/словосочетание", а не как подстрока
// внутри более длинного слова — иначе "ярослав" находится и внутри "ярославич" (отчество СЫНА,
// не тот же человек). Обе строки уже должны быть нормализованы (normalizeName).
export const containsWord = (haystack: string, needle: string) => {
    if (!needle) return false;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(haystack);
};

export const extractYear = (text?: string | null) => {
    if (!text) return undefined;
    const m = text.match(/\d{3,4}/);
    return m ? Number(m[0]) : undefined;
};
