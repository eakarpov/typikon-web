import clientPromise from "@/lib/mongodb";
import { reportError } from "@/lib/reportError";
import { CANDIDATES } from "@/lib/places/nikiforReview";
import { PLACES } from "@/lib/places/schema";
import { KIND_LABELS } from "@/lib/places/labels";

export interface NikiforCandidateView {
    id: string;
    status: string;
    reason: string;
    via: string;
    overlap: number;
    place: {
        id: string;
        name: string;
        href: string | null;
        kind: string | null;
        /** Несколько имён для узнавания: русские и латинские, без повторов. */
        names: string[];
        /** Статьи Никифора, уже связанные с местом. */
        articles: string[];
    };
}

export interface ArticleGroup {
    alias: string;
    name: string;
    snippet: string;
    /** Места, у которых эта статья уже стоит (скриптом или на ревью). */
    attachedTo: { name: string; href: string | null; byReview: boolean }[];
    candidates: NikiforCandidateView[];
    pending: number;
}

/** Начало статьи без разметки корпуса: ссылки — подписью, markdown — текстом. */
const plain = (content: string) => content
    .replace(/\{t\|[^|}]*\|([^}]*)\}/g, "$1")
    .replace(/\{[^}]*\}/g, "")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);

const hrefOf = (p: any) => (p.published === false ? null : `/places/${p.slug || p.alias || p._id}`);

/** Кандидаты по статье: у одной статьи часто несколько мест, и решать удобнее, видя их рядом. */
export const getArticleGroups = async (onlyPending: boolean): Promise<[ArticleGroup[] | null, any]> => {
    try {
        const db = (await clientPromise).db("typikon");
        const rows = await db.collection(CANDIDATES).find(onlyPending ? { status: "pending" } : {}).toArray();
        const aliases = [...new Set(rows.map((r) => r.alias as string))];
        const [texts, candidatePlaces, attached] = await Promise.all([
            db.collection("texts").find({ alias: { $in: aliases } }, { projection: { alias: 1, name: 1, content: 1 } }).toArray(),
            db.collection(PLACES).find({ _id: { $in: rows.map((r) => r.placeId) } },
                { projection: { name: 1, slug: 1, alias: 1, published: 1, kind: 1, names: 1, externals: 1 } }).toArray(),
            db.collection(PLACES).find({ externals: { $elemMatch: { source: "nikifor", id: { $in: aliases } } } },
                { projection: { name: 1, slug: 1, alias: 1, published: 1, externals: 1 } }).toArray(),
        ]);
        const textOf = new Map(texts.map((t) => [t.alias, t]));
        const placeOf = new Map(candidatePlaces.map((p) => [String(p._id), p]));

        const groups = new Map<string, ArticleGroup>();
        for (const r of rows) {
            const text = textOf.get(r.alias);
            const p = placeOf.get(String(r.placeId));
            if (!p) continue;
            const group: ArticleGroup = groups.get(r.alias) ?? {
                alias: r.alias,
                name: text?.name ?? r.alias,
                snippet: text ? plain(text.content) : "",
                attachedTo: attached
                    .filter((a) => (a.externals ?? []).some((e: any) => e.source === "nikifor" && e.id === r.alias))
                    .map((a) => ({
                        name: a.name,
                        href: hrefOf(a),
                        byReview: (a.externals ?? []).some((e: any) => e.source === "nikifor" && e.id === r.alias && e.by === "review"),
                    })),
                candidates: [],
                pending: 0,
            };
            const names: string[] = [...new Set<string>((p.names ?? [])
                .filter((n: any) => n.lang === "ru" || n.lang === "en")
                .map((n: any) => n.name as string))].slice(0, 8);
            group.candidates.push({
                id: String(r._id),
                status: r.status,
                reason: r.reason,
                via: r.via,
                overlap: r.overlap ?? 0,
                place: {
                    id: String(p._id),
                    name: p.name,
                    href: hrefOf(p),
                    kind: p.kind ? KIND_LABELS[p.kind as keyof typeof KIND_LABELS] ?? p.kind : null,
                    names,
                    articles: (p.externals ?? []).filter((e: any) => e.source === "nikifor").map((e: any) => e.id),
                },
            });
            if (r.status === "pending") group.pending++;
            groups.set(r.alias, group);
        }
        const list = [...groups.values()].sort((a, b) => (b.pending - a.pending) || a.name.localeCompare(b.name, "ru"));
        return [list, null];
    } catch (e) {
        reportError(e, { where: "app/admin/places/nikifor/api#getArticleGroups" });
        return [null, e];
    }
};
