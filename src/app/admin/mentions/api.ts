import clientPromise from "@/lib/mongodb";

export interface MentionCandidate {
    id: string;
    textId: string;
    textName: string;
    textAlias: string | null;
    dneslovId: string;
    saintTitle: string;
    word: string;
    context: string;
    tier: string;
    status: string;
}

export interface SaintGroup {
    dneslovId: string;
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
            .sort({ dneslovId: 1 })
            .toArray();

        const groups = new Map<string, SaintGroup>();
        for (const c of raw) {
            const group: SaintGroup = groups.get(c.dneslovId) ?? {
                dneslovId: c.dneslovId,
                saintTitle: c.saintTitle,
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
                dneslovId: c.dneslovId,
                saintTitle: c.saintTitle,
                word: c.word,
                context: c.context,
                tier: c.tier,
                status: c.status,
            });
            if (c.status === "approved") group.approved++;
            else if (c.status === "rejected") group.rejected++;
            else group.pending++;
            groups.set(c.dneslovId, group);
        }

        // Сначала то, что ещё не разобрано, и группы покрупнее — там больше отдача от решения.
        const list = [...groups.values()].sort((a, b) => (b.pending - a.pending) || (b.candidates.length - a.candidates.length));
        return [list, null];
    } catch (e) {
        console.error(e);
        return [null, { error: e }];
    }
};

export const getAppliedCount = async (): Promise<number> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        return await db.collection("mentionCandidates").countDocuments({ status: "applied" });
    } catch (e) {
        console.error(e);
        return 0;
    }
};
