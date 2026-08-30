import {unstable_cache} from "next/cache";

// Контент сайта меняется редко (правка текста в админке — событие раз в дни),
// а страницы при этом рендерятся динамически из-за cookie языка Библии и
// параметров вроде ?range. Поэтому кэшируем не страницы, а сами выборки из базы:
// рендер остаётся динамическим, но в Mongo мы за ним не ходим.
//
// Инвалидация — по тегам через POST /api/revalidate (см. src/app/api/revalidate),
// плюс страховка по времени.

export const CacheTag = {
    TEXTS: "texts",
    DAYS: "days",
    MONTHS: "months",
    BOOKS: "books",
    WEEKS: "weeks",
    SIGNS: "signs",
    NEWS: "news",
    SAINTS: "saints",
    // Библия отделена от TEXTS: её правят не редактором текста, а редактором
    // издания, и сбрасывать вместе с ней три тысячи богослужебных текстов незачем.
    BIBLE: "bible",
} as const;

export type CacheTagValue = typeof CacheTag[keyof typeof CacheTag];

// Час — верхняя граница расхождения, если инвалидация по тегу почему-то не дошла.
export const CONTENT_REVALIDATE = 3600;

// Список разделов меняется ещё реже, чем сам текст.
export const LIST_REVALIDATE = 3600;

export const cached = <Args extends any[], Result>(
    fn: (...args: Args) => Promise<Result>,
    keyParts: string[],
    tags: CacheTagValue[],
    revalidate: number = CONTENT_REVALIDATE,
) => unstable_cache(
    fn as (...args: any[]) => Promise<any>,
    keyParts,
    { tags, revalidate },
) as (...args: Args) => Promise<Result>;

// Большинство выборок в проекте возвращают пару [данные, ошибка]. Кэшировать
// такую пару целиком нельзя: при сбое базы в кэш на час ляжет ошибка. Поэтому
// внутрь кэша уходит только успешный результат, ошибка пробрасывается наружу.
export const cachedTuple = <Args extends any[]>(
    fn: (...args: Args) => Promise<[any, any]>,
    keyParts: string[],
    tags: CacheTagValue[],
    revalidate: number = CONTENT_REVALIDATE,
) => {
    const inner = cached(async (...args: Args) => {
        const [data, error] = await fn(...args);
        if (error) throw error;
        return data;
    }, keyParts, tags, revalidate);

    return async (...args: Args): Promise<[any, any]> => {
        try {
            return [await inner(...args), null];
        } catch (e) {
            console.error(e);
            return [null, e];
        }
    };
};
