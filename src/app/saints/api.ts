import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import { saintNames, saintSlugs } from "@/lib/saints";

// Указатель святых. Строится из наших данных — texts.dneslovId и texts.mentionIds
// дают, кто в корпусе представлен, а имя и адрес берутся из каталога `saints`.
//
// Раньше имена тянулись со святцев по сети, и только для показанной полусотни:
// выкачивать все 840 на каждый рендер было нельзя. Замер 2026-08-27 давал 39 секунд
// на страницу, когда dneslov отвечал через раз. Теперь имена свои, и ограничение
// осталось только на объём выборки.
//
// Порядок — по числу текстов, а не по алфавиту: так указатель честнее отвечает на
// вопрос «кто в корпусе представлен».

// Заготовки без содержимого в счёт не идут: обещать текст, которого нет, незачем.
const LINKABLE = ["ready", "correcting", "texted"];

export const SAINTS_PER_PAGE = 50;

export interface SaintRow {
    dneslovId: string;
    /** Наш адрес. null — если памяти ещё нет в каталоге: ссылка тогда идёт по номеру. */
    slug: string | null;
    /** Наше имя. null — тогда подписываем номером, как и прежде. */
    name: string | null;
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
        const existing = rows.get(id) ?? { dneslovId: id, slug: null, name: null, texts: 0, mentions: 0 };
        rows.set(id, existing);
        return existing;
    };

    own.forEach((item) => { row(item._id as string).texts = item.n; });
    mentioned.forEach((item) => { row(item._id as string).mentions = item.n; });

    // Имена и адреса — одним запросом на весь указатель: это своя коллекция, а не
    // чужой сервис, и экономить на ней незачем.
    const ids = [...rows.keys()];
    const [names, slugs] = await Promise.all([saintNames(ids), saintSlugs(ids)]);
    rows.forEach((r, id) => {
        r.name = names[id] ?? null;
        r.slug = slugs[id] ?? null;
    });

    // Числовая сортировка id во вторую очередь — иначе порядок внутри одинаковых
    // счётчиков зависит от того, как Mongo вернула группы, и страницы разъезжаются.
    return [...rows.values()].sort((a, b) =>
        (b.texts + b.mentions) - (a.texts + a.mentions)
        || Number(a.dneslovId) - Number(b.dneslovId));
    // Тег SAINTS здесь наравне с TEXTS: указатель теперь берёт из каталога имена и
    // адреса, и смена слуга (set-saint-slug.ts) должна его обновлять так же, как
    // правка текста.
}, ["saints-index"], [CacheTag.TEXTS, CacheTag.SAINTS]);

// Адреса страниц святых, у которых есть хоть один наш текст. Слуг, если память уже
// в каталоге; иначе номер святцев — страница по нему работает и уводит редиректом,
// когда каталог до неё дойдёт.
export const getSaintIds = async (): Promise<string[]> => {
    try {
        return (await getSaintRows()).map((item) => item.slug ?? item.dneslovId);
    } catch (e) {
        console.error(e);
        return [];
    }
};
