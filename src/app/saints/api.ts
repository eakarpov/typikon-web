import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";

// Указатель святых. Строится целиком из наших данных — из texts.dneslovId и
// texts.mentionIds; со святцев берутся только имена, и только для той полусотни,
// что показана на странице (см. src/lib/dneslov.ts).
//
// Порядок — по числу текстов, а не по алфавиту: алфавит требовал бы знать все 840
// имён заранее, то есть выкачивать святцы целиком на каждый рендер. Заодно такой
// порядок честнее отвечает на вопрос "кто в корпусе представлен".

// Заготовки без содержимого в счёт не идут: обещать текст, которого нет, незачем.
const LINKABLE = ["ready", "correcting", "texted"];

export const SAINTS_PER_PAGE = 50;

export interface SaintRow {
    dneslovId: string;
    texts: number;
    mentions: number;
}

export const getSaintRows = cached(async (): Promise<SaintRow[]> => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const texts = db.collection("texts");

    const [own, mentioned] = await Promise.all([
        texts.aggregate([
            { $match: { dneslovId: { $nin: [null, ""] }, readiness: { $in: LINKABLE } } },
            { $group: { _id: "$dneslovId", n: { $sum: 1 } } },
        ]).toArray(),
        texts.aggregate([
            { $match: { mentionIds: { $exists: true, $ne: [] }, readiness: { $in: LINKABLE } } },
            { $unwind: "$mentionIds" },
            { $group: { _id: "$mentionIds", n: { $sum: 1 } } },
        ]).toArray(),
    ]);

    const rows = new Map<string, SaintRow>();
    const row = (id: string) => {
        const existing = rows.get(id) ?? { dneslovId: id, texts: 0, mentions: 0 };
        rows.set(id, existing);
        return existing;
    };

    own.forEach((item) => { row(item._id as string).texts = item.n; });
    mentioned.forEach((item) => { row(item._id as string).mentions = item.n; });

    // Числовая сортировка id во вторую очередь — иначе порядок внутри одинаковых
    // счётчиков зависит от того, как Mongo вернула группы, и страницы разъезжаются.
    return [...rows.values()].sort((a, b) =>
        (b.texts + b.mentions) - (a.texts + a.mentions)
        || Number(a.dneslovId) - Number(b.dneslovId));
}, ["saints-index"], [CacheTag.TEXTS]);

// Все идентификаторы святых, у которых есть хоть один наш текст, — для карты сайта.
// Имена здесь не нужны: в sitemap.xml идут одни адреса.
export const getSaintIds = async (): Promise<string[]> => {
    try {
        return (await getSaintRows()).map((item) => item.dneslovId);
    } catch (e) {
        console.error(e);
        return [];
    }
};
