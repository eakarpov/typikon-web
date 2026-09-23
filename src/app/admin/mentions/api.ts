import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import {reportError} from "@/lib/reportError";

export interface MentionCandidate {
    id: string;
    textId: string;
    textName: string;
    textAlias: string | null;
    /** Святой — ключом каталога; номер святцев — только у кандидатов, чей святой в каталоге не нашёлся. */
    saintId: string | null;
    dneslovId: string | null;
    saintTitle: string;
    word: string;
    context: string;
    tier: string;
    status: string;
}

export interface SaintGroup {
    /** Ключ группы: ключ каталога или `n:номер` для святого вне каталога. */
    key: string;
    saintId: string | null;
    dneslovId: string | null;
    /** Адрес страницы святого у нас — туда ведёт ссылка из разбора. */
    slug: string | null;
    saintTitle: string;
    candidates: MentionCandidate[];
    pending: number;
    approved: number;
    rejected: number;
}

// Кандидаты группируются по святому: ошибки сопоставления кучкуются именно так
// (у одного святого имя совпало с обычным словом — и мимо идёт вся его пачка),
// поэтому решение чаще принимается сразу по группе, а не по одной строке.
export const getGroups = async (): Promise<[SaintGroup[] | null, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const raw = await db
            .collection("mentionCandidates")
            .find({ status: { $ne: "applied" } })
            .sort({ saintId: 1, dneslovId: 1 })
            .toArray();

        // Имя и адрес — из каталога: подпись кандидата снята в день его находки.
        const keys = [...new Set(raw.map((c: any) => c.saintId).filter(Boolean))] as string[];
        const cards = new Map((await db.collection("saints")
            .find({ _id: { $in: keys.filter((k) => ObjectId.isValid(k)).map((k) => new ObjectId(k)) } }, { projection: { name: 1, slug: 1 } })
            .toArray()).map((s: any) => [String(s._id), s]));

        const groups = new Map<string, SaintGroup>();
        for (const c of raw) {
            const key = c.saintId ? String(c.saintId) : `n:${c.dneslovId}`;
            const card = c.saintId ? cards.get(String(c.saintId)) : null;
            const group: SaintGroup = groups.get(key) ?? {
                key,
                saintId: c.saintId ?? null,
                dneslovId: c.dneslovId ?? null,
                slug: card?.slug ?? null,
                saintTitle: card?.name ?? c.saintTitle,
                candidates: [] as MentionCandidate[],
                pending: 0,
                approved: 0,
                rejected: 0,
            };
            group.candidates.push({
                id: c._id.toString(),
                textId: c.textId.toString(),
                textName: c.textName,
                textAlias: c.textAlias ?? null,
                saintId: c.saintId ?? null,
                dneslovId: c.dneslovId ?? null,
                saintTitle: c.saintTitle,
                word: c.word,
                context: c.context,
                tier: c.tier,
                status: c.status,
            });
            if (c.status === "approved") group.approved++;
            else if (c.status === "rejected") group.rejected++;
            else group.pending++;
            groups.set(key, group);
        }

        // Сначала то, что ещё не разобрано, и группы покрупнее — там больше отдача от решения.
        const list = [...groups.values()].sort((a, b) => (b.pending - a.pending) || (b.candidates.length - a.candidates.length));
        return [list, null];
    } catch (e) {
        reportError(e, { where: "app/admin/mentions/api#getGroups" });
        return [null, { error: e }];
    }
};

export const getAppliedCount = async (): Promise<number> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        return await db.collection("mentionCandidates").countDocuments({ status: "applied" });
    } catch (e) {
        reportError(e, { where: "app/admin/mentions/api#getAppliedCount" });
        return 0;
    }
};
