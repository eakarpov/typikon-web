import clientPromise from "@/lib/mongodb";

// Ревью связей «акафист — святой». Данные лежат в Mongo, а не в корпусе:
// data.db пересобирается с нуля, и всё записанное туда руками исчезает при
// следующем build_db.py. Подтверждённое отсюда выгружается в правила
// typikon-rules (см. src/scripts/export-akathist-saints.ts), и уже оттуда
// сборка проставляет akathists.dneslov_id.

export type LinkStatus = "pending" | "approved" | "rejected";

export interface SaintLink {
    id: string;
    akathistId: string;
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
    error: string | null;
}

const PAGE_LIMIT = 400;

export const getLinks = async (status: string): Promise<LinksData> => {
    try {
        const client = await clientPromise;
        const col = client.db("typikon").collection("akathist_saint_links");

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
                akathistId: r.akathistId,
                title: r.title ?? "",
                kind: r.kind ?? "exact",
                dneslovId: r.dneslovId ?? "",
                saintName: r.saintName ?? "",
                score: r.score ?? 0,
                alternatives: r.alternatives ?? [],
                status: r.status ?? "pending",
            })),
            counts,
            error: null,
        };
    } catch (e) {
        console.error(e);
        return { items: [], counts: {}, error: String(e) };
    }
};
