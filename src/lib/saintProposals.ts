// Очередь разбора святых из памятей Минеи: то, что импорт (import-memory-saints.ts)
// не решился завести сам. Здесь решение человека: завести с поправленным именем,
// присоединить памяти к записи, что уже есть, или отклонить.

import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { slugify, uniqueAlias } from "@/lib/news/format";
import { normalizeChurchSlavonic } from "@/utils/churchSlavonic";
import { getSaintByAddress } from "@/lib/saints";
import { CHIN_WORDS } from "@/lib/memorySaints";

import type { Proposal, ProposalMemory, ProposalReason, ProposalStatus } from "@/lib/saintProposalTypes";

const db = async () => (await clientPromise).db("typikon");

export const listProposals = async (status: ProposalStatus = "new"): Promise<Record<ProposalReason, Proposal[]>> => {
    const rows = await (await db()).collection("saint_proposals").find({ status }).sort({ reason: 1, _id: 1 }).toArray();
    const out = { "possible-duplicate": [], "no-epithet": [], "several": [], "no-name": [] } as Record<ProposalReason, Proposal[]>;
    for (const r of rows as any[]) {
        (out[r.reason as ProposalReason] ??= []).push({
            id: String(r._id), name: r.name ?? null, reason: r.reason, duplicates: r.duplicates ?? [],
            memories: r.memories ?? [], status: r.status,
        });
    }
    return out;
};

const provenanceOf = (m: ProposalMemory) => ({
    table: "memories", id: m.id, edition: m.book, chin: (m.chin && CHIN_WORDS[m.chin]) ?? null,
    office: null, text: m.label, url: null,
});

/** Завести святого из предложения — с именем, как его поправил человек, и сразу с адресом страницы. */
export const createFromProposal = async (id: string, name: string): Promise<{ slug: string } | { error: string }> => {
    const d = await db();
    const p = await d.collection("saint_proposals").findOne({ _id: id as any });
    if (!p) return { error: "нет такого предложения" };
    const clean = name.trim().replace(/\s+/g, " ");
    if (!/^[А-ЯЁ]/.test(clean) || clean.length > 120) return { error: "имя — с прописной, не длиннее 120 знаков" };
    const memories = p.memories as ProposalMemory[];
    const taken = new Set<string>([
        ...(await d.collection("saints").distinct("slug", { slug: { $type: "string" } })),
        ...(await d.collection("saints").distinct("previousSlugs")),
    ].map(String));
    const slug = uniqueAlias(slugify(normalizeChurchSlavonic(clean)) || "svyatoi", taken);
    await d.collection("saints").insertOne({
        slug, name: clean, type: "Identity", memoryDates: [...new Set(memories.map((m) => m.date))],
        altNames: [], title: null, orders: [], councils: [], baseYear: null, imageUrl: null, roundelUrl: null,
        images: [], externals: [], provenance: memories.map(provenanceOf),
        // Имя дал человек — перестройка его не трогает.
        manual: ["name"], createdAt: new Date(), updatedAt: new Date(),
    });
    await d.collection("saint_proposals").updateOne({ _id: id as any }, { $set: { status: "created", decidedAt: new Date() } });
    return { slug };
};

/**
 * Присоединить памяти к записи, что уже есть. Дни памяти дописываются только
 * записям нашего корпуса: у записей из снимка dneslov их пересобирает
 * build-saints.ts, и дописанное пропало бы при ближайшей пересборке.
 */
export const mergeProposal = async (id: string, address: string): Promise<{ slug: string | null } | { error: string }> => {
    const d = await db();
    const p = await d.collection("saint_proposals").findOne({ _id: id as any });
    if (!p) return { error: "нет такого предложения" };
    const key = address.trim().replace(/^.*\/saints\//, "").replace(/[/?#].*$/, "");
    const saint = ObjectId.isValid(key) && key.length === 24
        ? await d.collection("saints").findOne({ _id: new ObjectId(key) })
        : await getSaintByAddress(key);
    if (!saint) return { error: "такого святого в каталоге нет" };
    const memories = p.memories as ProposalMemory[];
    const ownDates = !(saint as any).externals?.length;
    await d.collection("saints").updateOne({ _id: (saint as any)._id }, {
        $addToSet: {
            provenance: { $each: memories.map(provenanceOf) },
            ...(ownDates ? { memoryDates: { $each: memories.map((m) => m.date) } } : {}),
        },
        $set: { updatedAt: new Date() },
    });
    await d.collection("saint_proposals").updateOne({ _id: id as any },
        { $set: { status: "merged", mergedInto: String((saint as any)._id), decidedAt: new Date() } });
    return { slug: (saint as any).slug ?? null };
};

export const dismissProposal = async (id: string): Promise<boolean> =>
    (await (await db()).collection("saint_proposals")
        .updateOne({ _id: id as any }, { $set: { status: "dismissed", decidedAt: new Date() } })).matchedCount > 0;
