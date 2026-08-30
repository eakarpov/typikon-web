import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { textDetail } from "@/lib/api/v2/serialize";
import { cached, CacheTag } from "@/lib/cache";

// Текст целиком. Принимает и alias, и идентификатор: alias — устойчивый адрес,
// но у части текстов его нет.
//
// Особый случай — /texts/random: случайный текст с содержимым. Отдельным маршрутом
// его не сделать, «random» всё равно попал бы сюда как идентификатор, поэтому
// разбирается здесь явно. Кэшу такой ответ не подлежит по смыслу.
export const revalidate = 3600;

const loadText = cached(async (idOrAlias: string) => {
    const client = await clientPromise;
    const db = client.db("typikon");

    const matcher = ObjectId.isValid(idOrAlias)
        ? { _id: new ObjectId(idOrAlias) }
        : { alias: idOrAlias };

    const doc = await db.collection("texts").findOne(matcher);
    if (!doc) return null;

    return doc;
}, ["api-v2-text"], [CacheTag.TEXTS]);

export async function OPTIONS() {
    return preflight();
}

const randomText = async () => {
    const client = await clientPromise;
    const docs = await client.db("typikon").collection("texts").aggregate([
        // Только то, что действительно можно читать: заготовки без содержимого не берём.
        { $match: { readiness: { $in: ["ready", "correcting", "texted"] }, content: { $nin: ["", null] } } },
        { $sample: { size: 1 } },
    ]).toArray();

    return docs[0] ?? null;
};

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    try {
        if (params.id === "random") {
            const doc = await randomText();
            if (!doc) return fail("not_found", "Не нашлось ни одного готового текста");
            return respond(textDetail(doc), { maxAge: 0, headers: { "Cache-Control": "no-store" }, access });
        }

        const doc = await loadText(params.id);

        if (!doc) {
            return fail("not_found", `Текст «${params.id}» не найден`);
        }

        return respond(textDetail(doc), { access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить текст");
    }
}
