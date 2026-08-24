import { normalizeChurchSlavonic } from "@/utils/churchSlavonic";

// Поиск идёт не по самому тексту, а по его нормализованной копии.
//
// Иначе он не работает: в тексте ударение стоит ВНУТРИ слова отдельным символом
// («стра́жи» — это с,т,р,а,U+0301,ж,и), поэтому запрос «стражи» не совпадёт с ним,
// как ни нормализуй сам запрос. Плюс 305 текстов набраны ЦС-графикой («і҆ѡа́нна»),
// и без приведения к гражданке они не находятся вовсе.
//
// Копия лежит в самих документах (searchName / searchContent) — это примерно +13 МБ
// на коллекцию в 25 МБ. Разнесены они, чтобы совпадение в названии весило больше.

export interface SearchFieldsSource {
    name?: string | null;
    content?: string | null;
    description?: string | null;
    author?: string | null;
    translator?: string | null;
    poems?: string | null;
}

export const buildSearchFields = (doc: SearchFieldsSource) => ({
    searchName: normalizeChurchSlavonic([doc.name, doc.description].filter(Boolean).join(" ")),
    searchContent: normalizeChurchSlavonic(
        [doc.content, doc.poems, doc.author, doc.translator].filter(Boolean).join(" "),
    ),
});

// Запрос приводим к тому же виду, что и текст, — иначе «Стра́жи» не найдёт «стражи».
export const normalizeQuery = (query: string) =>
    normalizeChurchSlavonic(query).replace(/\s+/g, " ").trim();

// Обратная карта к нормализации: под какими буквами может прятаться нормализованная.
const VARIANTS: Record<string, string> = {
    "е": "еѣєё", "у": "уꙋѹ", "я": "яѧѩꙗ", "о": "оѡѻ",
    "и": "иіїѵ", "з": "зѕ", "ф": "фѳ",
};

// Диакритика, которая может стоять между буквами: ударения и ЦС-надстрочные.
const MARKS = "[\\u0300-\\u036f\\u0483-\\u0489]*";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Регулярка, находящая нормализованное слово в ИСХОДНОМ тексте — со всеми ударениями
// и ЦС-буквами на своих местах. Нужна, чтобы показать фрагмент в том виде, в каком он
// написан, а не в нормализованном.
export const csInsensitivePattern = (term: string) =>
    [...normalizeQuery(term)]
        .map((ch) => {
            const variants = VARIANTS[ch];
            const cls = variants ? `[${variants}${variants.toUpperCase()}]` : `[${escape(ch)}${escape(ch.toUpperCase())}]`;
            return cls + MARKS;
        })
        .join("");

// Фрагмент вокруг первого совпадения — чтобы в выдаче было видно, за что текст найден.
export const snippetFor = (content: string | null | undefined, query: string, radius = 90): string | null => {
    if (!content) return null;
    const terms = normalizeQuery(query).split(" ").filter((t) => t.length > 2);
    if (!terms.length) return null;

    for (const term of terms) {
        let match: RegExpExecArray | null = null;
        try {
            match = new RegExp(csInsensitivePattern(term), "u").exec(content);
        } catch {
            match = null;
        }
        if (!match) continue;

        const from = Math.max(0, match.index - radius);
        const to = Math.min(content.length, match.index + match[0].length + radius);
        // Не рвём слова по краям фрагмента.
        const head = from > 0 ? content.slice(from).replace(/^\S*\s/, "") : content.slice(from);
        const cut = head.slice(0, to - from);
        const tail = to < content.length ? cut.replace(/\s\S*$/, "") : cut;

        return `${from > 0 ? "…" : ""}${tail.replace(/\s+/g, " ").trim()}${to < content.length ? "…" : ""}`;
    }

    return null;
};
