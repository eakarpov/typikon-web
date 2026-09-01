import clientPromise from "@/lib/mongodb";

// Ревью связей со святыми — и акафистов, и памятей книг. Две коллекции, одна
// страница: работа глазами одна и та же (подтвердить или поправить), и
// разводить её по двум экранам значило бы делать две одинаковые.
//
// Данные лежат в Mongo, а не в корпусе:
// data.db пересобирается с нуля, и всё записанное туда руками исчезает при
// следующем build_db.py. Подтверждённое отсюда выгружается в правила
// typikon-rules (см. src/scripts/export-akathist-saints.ts), и уже оттуда
// сборка проставляет akathists.dneslov_id.

export type LinkStatus = "pending" | "approved" | "rejected";

export type LinkTarget = "akathist" | "memory";

export interface SaintLink {
    id: string;
    /** Что связываем: акафист или память книги. */
    target: LinkTarget;
    /** akathist_id или memory_id — смотря что. */
    subjectId: string;
    /** Число месяцеслова у памяти; у акафиста его нет. */
    date: string | null;
    title: string;
    /** exact — предложено уверенно, ambiguous — кандидатов было несколько. */
    kind: string;
    dneslovId: string;
    saintName: string;
    score: number;
    alternatives: { dneslovId: string; saintName: string; score: number }[];
    status: LinkStatus;
    /** Кто подтвердил: "machine" — принято по двойному согласию, без человека. */
    approvedBy?: string | null;
    /**
     * Сошёлся ли день памяти святого с числом, под которым книга печатает
     * службу. Второй голос, независимый от слов имени. null — святого нет в
     * нашем каталоге, и второго голоса не существует (таких 455 из 653).
     */
    dateAgrees?: boolean | null;
    /** Скольким памятям предложен ЭТОТ ЖЕ святой: решение по ним общее. */
    sameSaint?: number;
    /** Сколько независимых примет сошлось. Им и упорядочена очередь. */
    confidence?: number;
}

export interface LinksData {
    items: SaintLink[];
    counts: Record<string, number>;
    target: LinkTarget;
    error: string | null;
}

const COLLECTION: Record<LinkTarget, string> = {
    akathist: "akathist_saint_links",
    memory: "memory_saint_links",
};

const PAGE_LIMIT = 400;

export const getLinks = async (status: string, target: LinkTarget): Promise<LinksData> => {
    try {
        const client = await clientPromise;
        const col = client.db("typikon").collection(COLLECTION[target] ?? COLLECTION.akathist);

        const filter = status === "all" ? {} : { status };
        const rows = await col.find(filter)
            // ПО ЧИСЛУ СОШЕДШИХСЯ ПРИМЕТ, а не по «качеству» вообще. Уверенные
            // первыми: их просмотр — подтверждение, и он идёт быстро;
            // сомнительные требуют выбора, и браться за них разумнее, уже набив
            // руку на простых. Прежде порядок держался на kind и score — на
            // одних словах имени; теперь впереди confidence, куда входит и
            // согласие ДАТЫ (см. prepare-memory-review.ts).
            //
            // Памяти одного святого стоят рядом: он предлагается нескольким
            // сразу — предпразднству, попразднству, отданию одного праздника, —
            // и решать их подряд вернее, чем встречать порознь через сотню строк.
            .sort({ confidence: -1, dneslovId: 1, score: -1, title: 1 })
            .limit(PAGE_LIMIT)
            .toArray();

        const counts: Record<string, number> = {};
        for (const s of ["pending", "approved", "rejected"]) {
            counts[s] = await col.countDocuments({ status: s });
        }

        return {
            items: rows.map((r: any) => ({
                id: r._id.toString(),
                target,
                subjectId: r.akathistId ?? r.memoryId,
                date: r.month ? `${r.month}-${r.day}` : null,
                title: r.title ?? "",
                kind: r.kind ?? "exact",
                dneslovId: r.dneslovId ?? "",
                saintName: r.saintName ?? "",
                score: r.score ?? 0,
                alternatives: r.alternatives ?? [],
                status: r.status ?? "pending",
                approvedBy: r.approvedBy ?? null,
                dateAgrees: r.dateAgrees ?? null,
                sameSaint: r.sameSaint ?? 1,
                confidence: r.confidence ?? 0,
            })),
            counts,
            target,
            error: null,
        };
    } catch (e) {
        console.error(e);
        return { items: [], counts: {}, target, error: String(e) };
    }
};
