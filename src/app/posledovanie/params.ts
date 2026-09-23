// Адрес страницы суточного круга — единственное место, где живёт выбор:
// дата, устав, язык, вариант дня, переносы, подача. Службу тогда можно
// переслать ссылкой, а «назад» возвращает к прежнему дню.

export type SearchParams = Record<string, string | string[] | undefined>;

export const first = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;

export const all = (v: string | string[] | undefined): string[] =>
    v === undefined ? [] : Array.isArray(v) ? v : [v];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Сегодня — по Москве, а не по часам сервера: день церковный сменяется
 * вечером, но гражданское число, которое человек ищет в календаре, —
 * московское.
 */
export const todayIso = () =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });

export const dateOf = (params: SearchParams) => {
    const raw = first(params.date);
    return raw && ISO.test(raw) && !Number.isNaN(Date.parse(raw)) ? raw : todayIso();
};

/** Что из выбора ПЕРЕЖИВАЕТ смену дня: устав, язык, подача. Вариант и
 *  переносы — свойства одного дня, и на другом они значили бы не то. */
export const KEEP_ACROSS_DAYS = ["ustav", "lang", "view", "parallel", "psalms"];

export const VIEW_PARAM = "view";
