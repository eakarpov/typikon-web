// Находки обходчика сайтов храмов: запись и разбор. Как они ищутся — ./crawl
// и src/scripts/crawl-temple-sites.ts.
//
// Кандидат — страница, а не святыня: на одной новости бывает и ковчег, и
// «мощи» из тропаря. Разбирающий читает отрывки и либо оформляет запись
// реестра (кандидат становится «использован»), либо отклоняет его. Повторный
// обход не воскрешает отклонённое: статус при обновлении не трогается.

import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { RELIC_CANDIDATES } from "./relics";
import { plain, type GuessKind, type GuessState, type Mention, type SaintRow } from "./crawl";

export const RELIC_CRAWL = "relicCrawl";

export type CandidateStatus = "new" | "used" | "dismissed";

export interface Candidate {
    id: string;
    url: string;
    site: string;
    templeSlugs: string[];
    title: string | null;
    published: string | null;
    mentions: Mention[];
    kind: GuessKind;
    state: GuessState;
    visit: { from: string; to: string } | null;
    saintGuess: string | null;
    saintCandidates: { dneslovId: string; name: string; slug: string | null }[];
    /** Откуда находка: сайт прихода (новость) или «Азбука паломника» (страница о храме). */
    origin?: "site" | "azbyka";
    /** Уточнение места внутри обители: «в Троицком соборе». */
    where?: string | null;
    status: CandidateStatus;
    foundAt: string;
}

const db = async () => (await clientPromise).db("typikon-users");

export type CandidateInput = Omit<Candidate, "id" | "status" | "foundAt">;

/** Запись находки. Статус задаётся только при первой записи — отклонённое остаётся отклонённым. */
export const upsertCandidate = async (c: CandidateInput) => {
    const now = new Date();
    await (await db()).collection(RELIC_CANDIDATES).updateOne(
        { url: c.url },
        { $set: { ...c, updatedAt: now }, $setOnInsert: { status: "new", foundAt: now } },
        { upsert: true },
    );
};

export const recordCrawl = async (site: string, fields: Record<string, unknown>) => {
    await (await db()).collection(RELIC_CRAWL).updateOne(
        { site }, { $set: { site, ...fields, lastCrawledAt: new Date() } }, { upsert: true });
};

/** Сайты, обойдённые позже этой даты: их повторный обход пропускается. */
export const recentlyCrawled = async (since: Date): Promise<Set<string>> => {
    const rows = await (await db()).collection(RELIC_CRAWL)
        .find({ lastCrawledAt: { $gte: since } }, { projection: { site: 1 } }).toArray();
    return new Set(rows.map((r) => r.site as string));
};

const toCandidate = (r: any): Candidate => ({
    id: String(r._id), url: r.url, site: r.site, templeSlugs: r.templeSlugs ?? [], title: r.title ?? null,
    published: r.published ?? null, mentions: r.mentions ?? [], kind: r.kind, state: r.state ?? null,
    visit: r.visit ?? null, saintGuess: r.saintGuess ?? null, saintCandidates: r.saintCandidates ?? [],
    origin: r.origin ?? "site", where: r.where ?? null,
    status: r.status, foundAt: new Date(r.foundAt).toISOString(),
});

/**
 * Очередь разбора: сперва принесённые на время и с датами — они устаревают
 * первыми, затем свежие публикации.
 */
export const listCandidates = async (status: CandidateStatus = "new", limit = 100): Promise<{ items: Candidate[]; total: number }> => {
    const col = (await db()).collection(RELIC_CANDIDATES);
    const [rows, total] = await Promise.all([
        col.find({ status }).sort({ "visit.from": -1, published: -1, foundAt: -1 }).limit(limit).toArray(),
        col.countDocuments({ status }),
    ]);
    return { items: rows.map(toCandidate), total };
};

export const setCandidateStatus = async (id: string, status: CandidateStatus): Promise<boolean> => {
    if (!ObjectId.isValid(id)) return false;
    const res = await (await db()).collection(RELIC_CANDIDATES)
        .updateOne({ _id: new ObjectId(id) }, { $set: { status, updatedAt: new Date() } });
    return res.matchedCount > 0;
};

/** Святые каталога для сличения догадок обходчика и импорта. */
export const loadSaintIndex = async (): Promise<SaintRow[]> =>
    (await (await clientPromise).db("typikon").collection("saints")
        .find({}, { projection: { _id: 0, name: 1, altNames: 1, slug: 1, externals: 1 } }).toArray())
        .map((s: any) => {
            const names = [s.name, ...(s.altNames ?? [])].filter(Boolean).map((n: string) => plain(n));
            return {
                dneslovId: String((s.externals ?? []).find((e: any) => e.source === "dneslov")?.id ?? ""),
                name: s.name, slug: s.slug ?? null,
                hay: names.join(" "),
                firsts: names.map((n: string) => n.split(/\s+/)[0]),
            };
        })
        .filter((s) => s.dneslovId);
