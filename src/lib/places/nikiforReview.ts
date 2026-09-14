// Ревью пар «место ↔ статья энциклопедии Никифора» (place_nikifor_candidates).
//
// Кандидатов оставляет link-nikifor, когда сам решить не может: чаще всего статья
// досталась нескольким местам сразу. Это бывает законно — «Кармил» описывает и город,
// и гору, — поэтому одна статья может быть принята у нескольких мест: ключ nikifor не
// уникален, в отличие от ключей Wikidata, Pleiades и OpenBible.
//
// Принятое решение пишется в само место и помечается: связь — `by: "review"`, имя —
// `article`. Повторный прогон link-nikifor такие связи не снимает и пару заново не
// предлагает; возврат пары в разбор снимает ровно то, что добавило принятие.
import { Db, ObjectId } from "mongodb";
import { slugify, uniqueAlias } from "@/lib/news/format";
import { headwordForms } from "@/lib/places/nikifor";
import { PLACES } from "@/lib/places/schema";

export const CANDIDATES = "place_nikifor_candidates";

/** Формы имени по заглавию статьи: «Авва (город)» → «Авва»; «Киринеи, Киринеянин» → обе. */
export const articleForms = (articleName: string): string[] =>
    headwordForms(articleName.replace(/\s*\([^)]*\)/g, "").trim());

export type Decision = "approved" | "rejected" | "pending";

export interface DecisionResult { status: Decision; renamed?: string; published?: boolean }

export const decideCandidate = async (db: Db, candidateId: string, status: Decision): Promise<DecisionResult> => {
    const candidates = db.collection(CANDIDATES);
    const candidate = await candidates.findOne({ _id: new ObjectId(candidateId) });
    if (!candidate) throw new Error("Кандидат не найден");
    const places = db.collection(PLACES);
    const place = await places.findOne({ _id: candidate.placeId });
    if (!place) throw new Error("Место не найдено");
    const alias: string = candidate.alias;
    const now = new Date();
    const result: DecisionResult = { status };

    // Снять то, что добавило прежнее принятие этой пары, — и при возврате в разбор, и при отклонении.
    const undo = async () => {
        await places.updateOne({ _id: place._id }, {
            $pull: { externals: { source: "nikifor", id: alias, by: "review" }, names: { source: "nikifor", article: alias } },
            $set: { updatedAt: now },
        } as any);
    };

    if (status === "approved") {
        const article = await db.collection("texts").findOne({ alias }, { projection: { name: 1 } });
        if (!article) throw new Error(`Статьи ${alias} нет в корпусе`);
        const forms = articleForms(article.name);
        const hasExternal = (place.externals ?? []).some((e: any) => e.source === "nikifor" && e.id === alias);
        const known = new Set((place.names ?? []).map((n: any) => n.name));
        const set: Record<string, any> = { updatedAt: now };

        // Русское имя — только месту, у которого его ещё нет: имя Wikidata («Кармель»)
        // решение о статье не вытесняет, английское («Beth-arabah») — вытесняет.
        if (!/[а-яё]/i.test(place.name) && forms.length === 1 && place.nameSource !== "editor") {
            set.name = forms[0];
            set.nameSource = "nikifor";
            result.renamed = forms[0];
            if (!place.slug) {
                let slug = slugify(forms[0]);
                const base = slug;
                const taken = new Set((await places.find({ slug: { $regex: `^${base}(-\\d+)?$` } }, { projection: { slug: 1 } }).toArray()).map((p) => p.slug));
                slug = uniqueAlias(base, taken);
                set.slug = slug;
            }
            if (place.published === false && !place.hiddenByEditor) {
                set.published = true;
                result.published = true;
            }
        }

        await places.updateOne({ _id: place._id }, {
            $set: set,
            $push: {
                ...(hasExternal ? {} : { externals: { source: "nikifor", id: alias, by: "review" } }),
                names: {
                    $each: forms.filter((f) => !known.has(f))
                        .map((name) => ({ name, lang: "ru", role: "biblical", source: "nikifor", article: alias })),
                },
            },
        } as any);
    } else {
        await undo();
    }

    await candidates.updateOne({ _id: candidate._id }, status === "pending"
        ? { $set: { status }, $unset: { reviewedAt: "" } }
        : { $set: { status, reviewedAt: now } });
    return result;
};
