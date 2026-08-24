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

// Нормализация церковнославянского текста для сопоставления: снимает ударения и надстрочные
// знаки (звательце, титло), приводит ЦС-графику к гражданской (ѣ→е, ꙋ→у, ѧ→я, ѡ→о, і→и, ѵ→и,
// ꙗ→я, ѳ→ф, ѕ→з), ё→е, регистр. Нужна там, где сравнивается написанное по-разному одно и то же
// слово: 2925 текстов набраны гражданкой с ударениями, ещё 305 — собственно ЦС-графикой.
const CS_LETTER_MAP: Record<string, string> = {
    "ѣ": "е", "ꙋ": "у", "ѹ": "у", "ѧ": "я", "ѩ": "я", "ꙗ": "я",
    "ѡ": "о", "ѿ": "от", "ѻ": "о", "і": "и", "ї": "и", "ѵ": "и",
    "є": "е", "ѕ": "з", "ѳ": "ф", "ѫ": "у", "ѯ": "кс", "ѱ": "пс",
};

export const normalizeChurchSlavonic = (text: string) =>
    text
        .normalize("NFD")
        // U+0300-U+036F — ударения; U+0483-U+0489 — титло, звательце и прочие ЦС-надстрочные.
        .replace(/[̀-ͯ҃-҉]/g, "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[ѣꙋѹѧѩꙗѡѿѻіїѵєѕѳѫѯѱ]/g, (ch) => CS_LETTER_MAP[ch] ?? ch);
