import { calcDay } from "@/lib/calcDay";
import { cached, CacheTag } from "@/lib/cache";
import { dayDetail, memory } from "@/lib/api/v2/serialize";
import { DAY_SLOT_ORDER, TextType, valueTitle } from "@/utils/texts";
import { DEFAULT_BIBLE_LANGUAGE } from "@/utils/bibleLanguage";

// Порядок слотов — общий с сайтом (@/utils/texts): порядок службы, а не порядок
// объявления полей. Евангелие на утрене читается до Литургии, и в перечислении
// TextType оно стоит последним — брать его порядок было бы ошибкой.
const SLOT_ORDER = DAY_SLOT_ORDER as readonly string[];

const slotTitle = (slot: string) => valueTitle(slot as TextType);

// Расчёт дня — самая тяжёлая операция на сайте (десятки $lookup плюс резолюция зачал),
// поэтому кэшируется по паре (дата, язык) и сбрасывается тегами при правке в админке.
export const calcDayCached = cached(
    (dateStr: string, lang: string) => calcDay(dateStr, lang),
    ["api-v2-calendar-day"],
    [CacheTag.DAYS, CacheTag.TEXTS, CacheTag.SIGNS],
);

/**
 * Ответ календарной ручки: что читается в конкретный день.
 * Здесь сходится всё — подвижный круг с отступками, неподвижный календарь,
 * памяти месяцеслова и зачала.
 */
export const calendarResponse = (date: string, result: any) => ({
    date,
    churchDate: result.date ? new Date(result.date).toISOString().slice(0, 10) : null,
    movable: result.search
        ? { week: result.search.week, day: result.search.day, type: result.search.type }
        : null,
    memories: {
        primary: result.memories?.default ? memory(result.memories.default) : null,
        secondary: (result.memories?.secondary ?? []).map(memory),
    },
    day: result.day ? dayDetail(result.day, SLOT_ORDER, slotTitle) : null,
});

export const BIBLE_LANG_PARAM = "lang";

export const readLang = (url: URL): string =>
    url.searchParams.get(BIBLE_LANG_PARAM) || DEFAULT_BIBLE_LANGUAGE;
