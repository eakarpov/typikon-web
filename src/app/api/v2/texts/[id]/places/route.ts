import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { cached, CacheTag } from "@/lib/cache";
import { textPlaces } from "@/lib/places/query";
import { reportError } from "@/lib/reportError";

// МЕСТА, НАЗВАННЫЕ В ЭТОМ ТЕКСТЕ.
//
// Не только помеченные разметкой `{pl|…}`: её в корпусе всего четыре текста.
// Почти все связи найдены разбором и приняты на сверке — по ним и собирается
// ответ, вместе с тем местом, о котором сама статья энциклопедии.
//
// Отдельной ручкой, а не полем `textDetail`: карточка текста — самая частая
// ручка приложения, а поиск мест бежит `$regex` по содержимому. Здесь же за него
// платит только тот экран, который места показывает.
export const revalidate = 3600;

const loadText = cached(async (idOrAlias: string) => {
    const db = (await clientPromise).db("typikon");
    const matcher = ObjectId.isValid(idOrAlias)
        ? { _id: new ObjectId(idOrAlias) }
        : { alias: idOrAlias };

    return db.collection("texts").findOne(matcher, { projection: { content: 1, alias: 1 } });
}, ["api-v2-text-places-doc"], [CacheTag.TEXTS]);

export async function OPTIONS() {
    return preflight();
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const { id } = await params;

    try {
        const doc = await loadText(id);
        if (!doc) return fail("not_found", `Текст «${id}» не найден`);

        const found = await textPlaces(String(doc._id), doc.content ?? "", doc.alias);

        return respondCollection(
            found.map((place) => ({
                id: place.id,
                /** Адрес места; по нему же его спрашивают ручкой `/places/{id}`. */
                slug: place.href.replace(/^\/places\//, ""),
                name: place.name,
                /** Текст — статья об этом месте, а не упоминание его в чтении. */
                subject: place.subject,
            })),
            { total: found.length, limit: found.length, offset: 0 },
            { access },
        );
    } catch (e) {
        reportError(e, { where: "app/api/v2/texts/[id]/places/route#GET", source: "api" });
        return fail("internal", "Не удалось получить места текста");
    }
}
