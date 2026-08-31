import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { pericope, verse } from "@/lib/api/v2/serialize";
import { resolvePericopeVersesWithFallback } from "@/lib/pericopes";
import { readLang } from "@/lib/api/v2/calendar";
import { cached, CacheTag } from "@/lib/cache";

// Зачало с разрешёнными стихами: диапазоны превращаются в сам текст.
export const revalidate = 3600;

const loadPericope = cached(async (id: string, lang: string) => {
    const client = await clientPromise;
    const db = client.db("typikon");

    const doc = await db.collection("pericopes").findOne({ _id: new ObjectId(id) });
    if (!doc) return null;

    // С запасным вариантом: если для запрошенного языка книги нет, отдаём
    // церковнославянский и честно говорим об этом в resolvedLang.
    const resolved = await resolvePericopeVersesWithFallback(db, doc, lang);

    return { doc, resolved };
}, ["api-v2-pericope"], [CacheTag.TEXTS]);

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const access = await authorize(request, "pericopes");
    if (access.denied) return access.denied;

    if (!ObjectId.isValid(params.id)) {
        return fail("bad_request", "Идентификатор зачала указан неверно");
    }

    try {
        const found = await loadPericope(params.id, readLang(new URL(request.url)));

        if (!found) return fail("not_found", "Зачало не найдено");

        const { doc, resolved } = found;

        return respond({
            ...pericope(doc),
            textId: resolved?.textId?.toString() ?? null,
            textName: resolved?.textName ?? null,
            textAlias: resolved?.textAlias ?? null,
            requestedLang: resolved?.requestedLang ?? null,
            resolvedLang: resolved?.resolvedLang ?? null,
            verses: (resolved?.verses ?? []).map(verse),
        }, { access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить зачало");
    }
}
