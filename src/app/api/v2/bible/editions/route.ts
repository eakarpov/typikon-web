import clientPromise from "@/lib/mongodb";
import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { bibleEdition } from "@/lib/api/v2/serialize";
import { publicEditions } from "@/lib/bible/query";

// Издания Библии: что вообще можно запросить у /api/v2/bible/{книга}/{глава}.
//
// Раздел живёт под областью доступа «texts», а не под своей: Библия и есть текст
// собрания, до этого её стихи отдавались через /api/v2/texts/{id}, и переезд на
// отдельные адреса не должен заставлять внешних клиентов менять ключ.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    try {
        const db = (await clientPromise).db("typikon");
        const editions = await publicEditions(db);

        return respondCollection(
            editions.map(bibleEdition),
            { total: editions.length, limit: editions.length, offset: 0 },
            { access },
        );
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить издания Библии");
    }
}
