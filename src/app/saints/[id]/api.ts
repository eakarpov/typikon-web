import clientPromise from "@/lib/mongodb";
import { init } from "@/lib/sqlite";
import { cachedTuple, cached, CacheTag } from "@/lib/cache";
import { snapshotOfMemory } from "@/lib/saints";
import { saintMemory } from "@/lib/dneslov";

// Номеров святцев у записи каталога может быть несколько — две их памяти, сведённые
// нами в одно лицо (см. @/lib/saintSources о том, почему такое бывает и почему
// внешние ключи хранятся списком). Поэтому выборки берут не номер, а их набор.

/** Тексты, написанные к памяти святого (или им самим — см. dneslovType). */
export const getItems = cachedTuple(async (ids: string[]): Promise<[any, any]> => {
    try {
        if (!ids.length) return [[], null];
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: { dneslovId: { $in: ids } } },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0, createdAt: false, updatedAt: false }}
            ])
            .toArray();
        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
}, ["saint-texts"], [CacheTag.TEXTS]);

// Тексты, в которых святой упомянут, — обратная сторона mentionIds. Вместе с текстом
// отдаём и сам фрагмент (texts.mentions[].context): ради него ревью в /admin/mentions
// и затевалось, а список одних заголовков читать нечем.
export const getMentions = cachedTuple(async (ids: string[]): Promise<[any, any]> => {
    try {
        if (!ids.length) return [[], null];
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: { mentionIds: { $elemMatch: { $in: ids } } } },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                        mention: {
                            $first: {
                                $filter: {
                                    input: { $ifNull: ["$mentions", []] },
                                    as: "m",
                                    cond: { $in: ["$$m.dneslovId", ids] },
                                },
                            },
                        },
                    },
                },
                { $project: { _id: 0, createdAt: false, updatedAt: false }}
            ])
            .toArray();
        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
}, ["saint-mentions"], [CacheTag.TEXTS]);

// Обратная связь родословная -> святой: если номер сопоставлен с персоной в nobles.db
// (см. /admin/nobles/import, скрипт link-nobles-dneslov), показываем ссылку на её страницу.
export const getLinkedNoble = async (ids: string[]): Promise<[any, any]> => {
    try {
        if (!ids.length) return [null, null];
        const db = await init();
        const noble = db
            .prepare(`select id, name from nobles where dneslovId in (${ids.map(() => "?").join(",")}) limit 1`)
            .get(...ids);
        return [noble ?? null, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

/**
 * Карточка памяти. Берём из снимка святцев (коллекция `dneslov_memories`), а не по
 * сети: раньше этот запрос уходил на dneslov.org при каждом показе, шёл в два шага и
 * при их недоступности оставлял страницу без имени. Сеть осталась запасным путём —
 * на случай памяти, которую снимок ещё не застал.
 */
export const getMemory = cached(async (dneslovId?: string): Promise<any | null> => {
    if (!dneslovId) return null;
    return (await snapshotOfMemory(dneslovId)) ?? (await saintMemory(dneslovId));
}, ["saint-memory"], [CacheTag.SAINTS]);
