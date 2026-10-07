// РАЗБОР НАХОДОК ПРЕСТОЛОВ: выборки для админки и смена статуса.
//
// Престолы ложатся в `temples.prestoly` догадкой — из имени храма (правилом
// словаря), с сайта прихода или из Соборов.ру, — и все со статусом `pending`.
// Показывать читателю и отдавать уставу можно только выверенное (`approved`);
// отвергнутое (`rejected`) остаётся памяткой: повторный обход его не вернёт.
//
// РАЗБИРАТЬ ПРАВИЛОМ, А НЕ ПОШТУЧНО. Догадка из имени — общая для тысяч храмов
// сразу: «все „Николы“» либо верны, либо нет как класс. Поэтому главный вид
// разбора — сводка по посвящению и источнику (`listPrestolGroups`): увидев
// ошибку породы «Борисоглебская епархия → Борис и Глеб», её снимают целым
// классом. Поштучный вид (`listTempleFindings`) — для находок с отрывком, где
// судить надо по странице.

import clientPromise from "@/lib/mongodb";
import type {
    GroupPage, PrestolFinding, PrestolGroup, PrestolStatus, TempleFindings,
} from "./prestolSources";

// Словарь и образы престола — общие с клиентом, в @/lib/pilgrimage/prestolSources.
export type { GroupPage, PrestolFinding, PrestolGroup, PrestolStatus, TempleFindings };

export interface GroupQuery {
    status?: PrestolStatus;
    sources?: string[];
    /** Поиск по названию посвящения. */
    search?: string;
    limit?: number;
    offset?: number;
}

const db = async () => (await clientPromise).db("typikon");

const sourceMatch = (sources?: string[]) =>
    sources && sources.length ? { "prestoly.source": { $in: sources } } : {};

/**
 * Сводка догадок по посвящению и источнику. Классы крупные сверху: с них и
 * начинается разбор — одна правка снимает тысячи ложных связей.
 */
export const listPrestolGroups = async (q: GroupQuery = {}): Promise<GroupPage> => {
    const status = q.status ?? "pending";
    const limit = Math.min(1000, Math.max(1, q.limit ?? 400));
    const offset = Math.max(0, q.offset ?? 0);
    const search = q.search?.trim();

    const rows = await (await db()).collection("temples").aggregate([
        { $unwind: "$prestoly" },
        { $match: { "prestoly.status": status, ...sourceMatch(q.sources), ...(search ? { "prestoly.label": { $regex: search, $options: "i" } } : {}) } },
        {
            $group: {
                _id: { dedication: "$prestoly.dedication", source: "$prestoly.source" },
                label: { $first: "$prestoly.label" },
                kind: { $first: "$prestoly.kind" },
                n: { $sum: 1 },
                main: { $sum: { $cond: ["$prestoly.isMain", 1, 0] } },
                low: { $min: "$prestoly.confidence" },
                high: { $max: "$prestoly.confidence" },
                patterns: { $addToSet: "$prestoly.pattern" },
                sample: { $first: "$name" },
                sampleSlug: { $first: "$slug" },
            },
        },
        { $sort: { n: -1, _id: 1 } },
        { $facet: {
            items: [{ $skip: offset }, { $limit: limit }],
            total: [{ $count: "n" }],
        } },
    ], { allowDiskUse: true }).toArray();

    const head = rows[0] ?? { items: [], total: [] };
    return {
        total: head.total[0]?.n ?? 0,
        items: head.items.map((r: any): PrestolGroup => ({
            dedication: r._id.dedication,
            source: r._id.source,
            label: r.label ?? r._id.dedication,
            kind: r.kind,
            n: r.n,
            main: r.main,
            low: r.low ?? 0,
            high: r.high ?? 0,
            patterns: (r.patterns ?? []).filter(Boolean).sort(),
            sample: r.sample ?? "",
            sampleSlug: r.sampleSlug ?? "",
        })),
    };
};

export interface TempleQuery {
    status?: PrestolStatus;
    sources?: string[];
    /** Ограничить одним посвящением — переход из сводки в список храмов. */
    dedication?: string;
    search?: string;
    limit?: number;
    offset?: number;
}

export const listTempleFindings = async (q: TempleQuery = {}) => {
    const status = q.status ?? "pending";
    const limit = Math.min(200, Math.max(1, q.limit ?? 40));
    const offset = Math.max(0, q.offset ?? 0);
    const search = q.search?.trim();
    const col = (await db()).collection("temples");

    const elem: any = { status, ...(q.sources?.length ? { source: { $in: q.sources } } : {}) };
    if (q.dedication) elem.dedication = q.dedication;
    const filter: any = { prestoly: { $elemMatch: elem } };
    if (search) filter.name = { $regex: search, $options: "i" };

    const [total, rows] = await Promise.all([
        col.countDocuments(filter),
        col.find(filter, { projection: { _id: 0, slug: 1, name: 1, place: 1, country: 1, prestoly: 1 } })
            .sort({ name: 1 }).skip(offset).limit(limit).toArray(),
    ]);

    const items: TempleFindings[] = rows.map((t: any) => ({
        slug: t.slug,
        name: t.name,
        place: t.place,
        country: t.country,
        findings: (t.prestoly ?? []).filter((p: any) =>
            p.status === status
            && (!q.sources?.length || q.sources.includes(p.source))
            && (!q.dedication || p.dedication === q.dedication))
            .map((p: any): PrestolFinding => ({
                dedication: p.dedication, label: p.label, isMain: !!p.isMain, kind: p.kind,
                source: p.source, status: p.status, tier: p.tier, pattern: p.pattern,
                confidence: p.confidence, evidence: p.evidence,
            })),
    }));
    return { items, total };
};

/** Сколько находок ждёт разбора — по источникам и статусам, для шапки. */
export const countPrestolFindings = async (): Promise<Record<string, Record<string, number>>> => {
    const rows = await (await db()).collection("temples").aggregate([
        { $unwind: "$prestoly" },
        { $group: { _id: { source: "$prestoly.source", status: "$prestoly.status" }, n: { $sum: 1 } } },
    ], { allowDiskUse: true }).toArray();
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows as any[]) {
        const s = r._id.source ?? "—";
        out[s] ??= {};
        out[s][r._id.status] = r.n;
    }
    return out;
};

const approvalFields = (status: PrestolStatus, by?: string | null) => {
    const now = new Date();
    const set: Record<string, unknown> = {
        "prestoly.$[p].status": status,
        "prestoly.$[p].reviewedAt": now,
    };
    if (status === "approved") {
        set["prestoly.$[p].approvedBy"] = by ?? null;
    }
    return set;
};

/** Смена статуса одного престола: храм + ключ посвящения. */
export const setPrestolStatus = async (
    slug: string, dedication: string, status: PrestolStatus, by?: string | null,
): Promise<number> =>
    (await (await db()).collection("temples").updateOne(
        { slug },
        { $set: approvalFields(status, by) },
        { arrayFilters: [{ "p.dedication": dedication }] },
    )).modifiedCount;

/**
 * Разбор целого класса: все ещё не тронутые находки этого посвящения из этого
 * источника. Обновлённых храмов возвращаем числом — престолов в них бывает и
 * больше одного.
 */
export const setPrestolGroupStatus = async (
    dedication: string, source: string, status: PrestolStatus, by?: string | null,
): Promise<number> =>
    (await (await db()).collection("temples").updateMany(
        { prestoly: { $elemMatch: { dedication, source, status: "pending" } } },
        { $set: approvalFields(status, by) },
        { arrayFilters: [{ "p.dedication": dedication, "p.source": source, "p.status": "pending" }] },
    )).modifiedCount;

/** Разбор всего храма: все его ещё не тронутые находки. */
export const setTempleFindingsStatus = async (
    slug: string, status: PrestolStatus, by?: string | null,
): Promise<number> =>
    (await (await db()).collection("temples").updateOne(
        { slug },
        { $set: approvalFields(status, by) },
        { arrayFilters: [{ "p.status": "pending" }] },
    )).modifiedCount;
