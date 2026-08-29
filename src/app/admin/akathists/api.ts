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
            // Уверенные первыми: их просмотр — подтверждение, и он идёт быстро.
            // Неоднозначные требуют выбора, и разумнее браться за них, уже
            // набив руку на простых. Порядок УБЫВАЮЩИЙ по kind: по алфавиту
            // "ambiguous" встаёт раньше "exact", и возрастающий давал ровно
            // обратное задуманному.
            .sort({ kind: -1, score: -1, title: 1 })
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
