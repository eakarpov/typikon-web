import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {DayDTO} from "@/types/dto/days";
import {getAggregationFindIdInField} from "@/utils/database";
import {filterVersesByRanges, parseVerseRanges, sortVerses} from "@/utils/verses";
import {TextContentType} from "@/utils/texts";
import {cached, CacheTag} from "@/lib/cache";
import {saintTitles} from "@/lib/dneslov";
import {coverageFor} from "@/lib/accents/store";
import {markText} from "@/lib/accents/service";
import {libFondCipher, libFondUrl, type LibFondSource} from "@/lib/libFond";

// Сам текст и его стихи кэшируются целиком; фильтрация по ?range идёт уже
// поверх кэша, иначе каждый диапазон занимал бы отдельную запись.
const loadText = cached(async (id: string) => {
    const client = await clientPromise;
    const db = client.db("typikon");

    const matcher = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { alias: id };

    const texts = await db
        .collection("texts")
        .aggregate([
            { $match: matcher },
            {
                $addFields: {
                    id: { $toString: "$_id" },
                },
            },
            { $project: { _id: 0 }}
        ])
        .toArray();
    const res = texts[0];

    if (!res) return null;

    if (res.contentType === TextContentType.VERSES) {
        const rawVerses = await db
            .collection("verses")
            .find({ textId: new ObjectId(res.id) })
            .toArray();
        res.verses = sortVerses(rawVerses.map(v => ({
            id: v._id.toString(),
            chapter: v.chapter,
            verse: v.verse,
            content: v.content,
        })));
    }

    return res;
}, ["reading-text"], [CacheTag.TEXTS]);

export const getItem = async (id: string, range?: string): Promise<[any, any, boolean]> => {
    try {
        const shouldRedirect = ObjectId.isValid(id);
        const res = await loadText(id);

        if (!res) {
            return [undefined, null, false];
        }

        if (res.contentType === TextContentType.VERSES) {
            return [
                { ...res, verses: filterVersesByRanges(res.verses || [], parseVerseRanges(range)) },
                null,
                shouldRedirect && res.alias,
            ];
        }

        return [res, null, shouldRedirect && res.alias];
    } catch (e) {
        console.error(e);
        return [null, e, false];
    }
};

// Поиск дня, в котором встречается текст, — переборная агрегация по всем слотам
// дня, индексом не покрывается. Тем более имеет смысл держать её в кэше.
const loadDayByText = cached(async (id: string) => {
    const client = await clientPromise;
    const db = client.db("typikon");

    const texts = await db
        .collection("days")
        .aggregate([
            { $match: {
                    $expr: {
                        $or: [
                            // getAggregationFindIdInField(id, "$vespersProkimenon"),
                            getAggregationFindIdInField(id, "$vigil"),
                            getAggregationFindIdInField(id, "$kathisma1"),
                            getAggregationFindIdInField(id, "$kathisma2"),
                            getAggregationFindIdInField(id, "$kathisma3"),
                            getAggregationFindIdInField(id, "$ipakoi"),
                            getAggregationFindIdInField(id, "$polyeleos"),
                            getAggregationFindIdInField(id, "$song3"),
                            getAggregationFindIdInField(id, "$song6"),
                            getAggregationFindIdInField(id, "$apolutikaTroparia"),
                            getAggregationFindIdInField(id, "$before1"),
                            getAggregationFindIdInField(id, "$h1"),
                            getAggregationFindIdInField(id, "$h3"),
                            getAggregationFindIdInField(id, "$h6"),
                            getAggregationFindIdInField(id, "$h9"),
                            getAggregationFindIdInField(id, "$panagia"),
                        ],
                    },
                },
            },
            {
                $lookup: {
                    from: "weeks",
                    localField: "weekId",
                    foreignField: "_id",
                    as: "weeks"
                },
            },
            {
                $addFields: {
                    id: { $toString: "$_id" },
                    week: { $arrayElemAt: ["$weeks", 0]},
                },
            },
            { $project: { _id: 0, weeks: 0, "week._id": 0, "week.days": 0 }}
        ])
        .toArray();
    return (texts[0] as DayDTO) || null;
}, ["reading-day-by-text"], [CacheTag.DAYS, CacheTag.TEXTS]);

export const getDayByText = async (id: string): Promise<[DayDTO|null, boolean]> => {
    try {
        return [await loadDayByText(id), false];
    } catch (e) {
        console.error(e);
        return [null, true];
    }
};

// --- Связи текста -------------------------------------------------------------
//
// Граф уже лежит в базе, но до читателя доходил только одной стороной: со страницы
// святого было видно его тексты, а со страницы текста — ничего, кроме одинокой
// ссылки "Страница святого" в шапке. Здесь собираем обе стороны разом:
//   * память — чей это текст (texts.dneslovId) и что ещё написано к той же памяти;
//   * упоминания — кто помянут внутри (texts.mentionIds, ревью в /admin/mentions).
//
// Имена святых берём отдельно, через кэш src/lib/dneslov.ts: они чужие и в базе
// не хранятся, поэтому в один запрос с текстами их не собрать.

// Заготовки без содержимого в соседи не годятся: ссылка на пустую страницу —
// не связь, а тупик. Тот же отбор, что и в карте сайта.
const LINKABLE = ["ready", "correcting", "texted"];

export interface TextLink {
    id: string;
    name: string;
}

export interface TextLinks {
    memory: { dneslovId: string; title: string; siblings: TextLink[]; total: number } | null;
    mentions: { dneslovId: string; title: string }[];
}

const loadSiblings = cached(async (dneslovId: string, selfId: string) => {
    const client = await clientPromise;
    const db = client.db("typikon");

    const texts = await db
        .collection("texts")
        .find(
            {
                dneslovId,
                _id: { $ne: new ObjectId(selfId) },
                readiness: { $in: LINKABLE },
                name: { $nin: ["", null] },
            },
            { projection: { alias: 1, name: 1 } },
        )
        .toArray();

    return texts.map((text) => ({
        id: (text.alias as string) || text._id.toString(),
        name: text.name as string,
    }));
}, ["reading-saint-siblings"], [CacheTag.TEXTS]);

/**
 * Опись источника, на скан которого ссылается текст.
 *
 * Ходим в свою коллекцию `sources`, а не на lib-fond: одна опись стоит
 * источником у десятков текстов, и держать рендер страницы в ожидании чужого
 * сайта незачем — тем более такого, который отвечает через раз (см.
 * src/scripts/fetch-lib-fond.ts, там на две описи из тридцати пяти не хватило
 * десятисекундного срока связи).
 *
 * Не забранная опись — не повод молчать: шифр («Ф.7 №13») читается прямо из
 * адреса ссылки, и он честнее пустоты.
 */
export const getTextSource = cached(async (link: string | null): Promise<LibFondSource | null> => {
    const url = libFondUrl(link);
    if (!url) return null;
    const cipher = libFondCipher(url);
    try {
        const client = await clientPromise;
        const doc = await client.db("typikon").collection("sources").findOne({ url });
        return { url, title: doc?.title || null, cipher: doc?.cipher || cipher };
    } catch (e) {
        console.error(e);
        return { url, title: null, cipher };
    }
}, ["text-source"], [CacheTag.TEXTS]);

export const getTextLinks = async (item: any): Promise<TextLinks> => {
    const dneslovId: string = item?.dneslovId || "";
    const mentionIds: string[] = Array.isArray(item?.mentionIds) ? item.mentionIds.filter(Boolean) : [];

    if (!dneslovId && !mentionIds.length) {
        return { memory: null, mentions: [] };
    }

    try {
        const [siblings, titles] = await Promise.all([
            dneslovId && item?.id ? loadSiblings(dneslovId, item.id) : Promise.resolve([]),
            saintTitles([dneslovId, ...mentionIds]),
        ]);

        return {
            memory: dneslovId
                ? {
                    dneslovId,
                    title: titles[dneslovId],
                    // Показываем горсть, а не весь список: у самых представленных
                    // памятей текстов под два десятка, и это уже не связь, а оглавление.
                    siblings: siblings.slice(0, 5),
                    total: siblings.length,
                }
                : null,
            mentions: mentionIds.map((id) => ({ dneslovId: id, title: titles[id] })),
        };
    } catch (e) {
        console.error(e);
        return { memory: null, mentions: [] };
    }
};

// --- показ с машинными ударениями ---------------------------------------------
//
// 65 с лишним текстов собрания не размечены вовсе или размечены наполовину: ПВЛ,
// службы, акафисты, Маргарит, Часослов. Вслух их не прочесть, а писать машинные
// ударения в корпус нельзя — это была бы уже не вычитанная книга.
//
// Поэтому ударения предлагаются КАК ВИД: текст в базе остаётся как есть, а читателю
// показывается размеченная копия с прямой пометкой, что знаки поставила машина.

export interface AccentedView {
    content: string;
    /** Сколько знаков поставлено и сколько слов их ждали. */
    marked: number;
    expected: number;
}

// ПВЛ — 55 тысяч слов, и разметка её каждый раз заново обошлась бы дороже самой
// страницы. Кэш по тому же тегу, что и текст: правят текст — пересчитается и вид.
const buildAccentedView = cached(async (id: string, content: string): Promise<AccentedView> => {
    const result = await markText(content, "reading");

    return {
        content: result.tokens.map((token) => token.text).join(""),
        marked: result.marked,
        expected: result.expected,
    };
}, ["reading-accented-view"], [CacheTag.TEXTS]);

/**
 * Стоит ли предлагать показ с ударениями и как он выглядит. null — текст размечен,
 * предлагать нечего.
 */
export const getAccentedView = async (item: any, wanted: boolean): Promise<AccentedView | null> => {
    if (!item?.alias || typeof item.content !== "string" || !item.content.trim()) return null;

    try {
        const coverage = await coverageFor(item.alias);
        if (!coverage) return null;
        if (!wanted) return { content: "", marked: 0, expected: coverage.need - coverage.has };

        return await buildAccentedView(item.alias, item.content);
    } catch (e) {
        console.error(e);
        return null;
    }
};
