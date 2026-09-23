import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import {reportError} from "@/lib/reportError";

// Указатель святых — от нашего каталога (`saints`), а не от текстов.
//
// Прежде он строился из texts.dneslovId и texts.mentionIds: в указатель попадал
// тот, у кого есть номер святцев и хоть один текст. С тех пор каталог пополнился
// лицами нашего корпуса — Собором новомучеников и святыми из памятей Минеи
// (Александр Невский, Серафим Саровский), — у которых номера нет, и указатель от
// текстов их бы не увидел. Теперь в нём всякая запись каталога с адресом, а
// счётчики чтений и упоминаний сводятся к записи через её номера святцев.
//
// Номер из текста, которого в каталоге нет, остаётся строкой, как прежде: страница
// по номеру работает, и терять её из указателя незачем.
//
// Порядок — по числу текстов, затем по имени: так указатель честнее отвечает на
// вопрос «кто в корпусе представлен», а записи без текстов идут следом по алфавиту.

// Заготовки без содержимого в счёт не идут: обещать текст, которого нет, незачем.
const LINKABLE = ["ready", "correcting", "texted"];

export const SAINTS_PER_PAGE = 50;

export interface SaintRow {
    /** Ключ строки: ключ записи каталога или, для памяти вне каталога, номер святцев. */
    key: string;
    /** Номер святцев, если строка — память вне каталога: ссылка тогда идёт по нему. */
    dneslovId: string | null;
    slug: string | null;
    name: string | null;
    /** Прочие именования — не показываются, но по ним ищут (см. @/lib/saintSearch). */
    altNames: string[];
    texts: number;
    mentions: number;
}

export const getSaintRows = cached(async (): Promise<SaintRow[]> => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const texts = db.collection("texts");

    const [own, mentioned, saints] = await Promise.all([
        texts.aggregate([
            { $match: { dneslovId: { $nin: [null, ""] }, readiness: { $in: LINKABLE } } },
            { $group: { _id: "$dneslovId", n: { $sum: 1 } } },
        ]).toArray(),
        texts.aggregate([
            { $match: { mentionIds: { $exists: true, $ne: [] }, readiness: { $in: LINKABLE } } },
            { $unwind: "$mentionIds" },
            { $group: { _id: "$mentionIds", n: { $sum: 1 } } },
        ]).toArray(),
        db.collection("saints").find({ slug: { $type: "string" } },
            { projection: { slug: 1, name: 1, altNames: 1, externals: 1 } }).toArray(),
    ]);
    const textsOf = new Map(own.map((r) => [String(r._id), r.n as number]));
    const mentionsOf = new Map(mentioned.map((r) => [String(r._id), r.n as number]));

    const rows: SaintRow[] = [];
    const covered = new Set<string>();
    for (const s of saints as any[]) {
        const numbers = (s.externals ?? []).filter((e: any) => e.source === "dneslov").map((e: any) => String(e.id));
        numbers.forEach((n: string) => covered.add(n));
        rows.push({
            key: String(s._id), dneslovId: null, slug: s.slug, name: s.name ?? null, altNames: s.altNames ?? [],
            texts: numbers.reduce((sum: number, n: string) => sum + (textsOf.get(n) ?? 0), 0),
            mentions: numbers.reduce((sum: number, n: string) => sum + (mentionsOf.get(n) ?? 0), 0),
        });
    }
    // Памяти вне каталога — прежние строки по номеру.
    for (const n of new Set([...textsOf.keys(), ...mentionsOf.keys()])) {
        if (covered.has(n)) continue;
        rows.push({ key: `n:${n}`, dneslovId: n, slug: null, name: null, altNames: [], texts: textsOf.get(n) ?? 0, mentions: mentionsOf.get(n) ?? 0 });
    }

    // Имя во вторую очередь, ключ в третью — иначе порядок внутри одинаковых
    // счётчиков зависит от того, как Mongo вернула записи, и страницы разъезжаются.
    return rows.sort((a, b) =>
        (b.texts + b.mentions) - (a.texts + a.mentions)
        || (a.name ?? "\uffff").localeCompare(b.name ?? "\uffff", "ru")
        || a.key.localeCompare(b.key));
}, ["saints-index"], [CacheTag.TEXTS, CacheTag.SAINTS]);

// Адреса страниц святых указателя: слуг записи; для памяти вне каталога — номер
// святцев, страница по нему работает.
export const getSaintIds = async (): Promise<string[]> => {
    try {
        return (await getSaintRows()).map((item) => item.slug ?? item.dneslovId ?? "").filter(Boolean);
    } catch (e) {
        reportError(e, { where: "app/saints/api#getSaintIds" });
        return [];
    }
};
