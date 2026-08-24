import clientPromise from "@/lib/mongodb";
import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { limitOrFail } from "@/lib/api/v2/rateLimit";
import { readPage } from "@/lib/api/v2/params";
import { textSummary } from "@/lib/api/v2/serialize";
import { MIN_QUERY_LENGTH } from "@/app/search/api";
import { normalizeQuery, snippetFor } from "@/lib/search";

// Поиск по названию и содержимому. Ударения и церковнославянское написание набирать
// не нужно: и запрос, и тексты сравниваются в нормализованном виде (см. @/lib/search).
export const revalidate = 0;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    // Поиск дороже прочих ручек, поэтому и счётчик у него свой.
    const limited = limitOrFail(request, "api-v2-search");
    if (limited) return limited;

    const url = new URL(request.url);
    const { limit, offset } = readPage(url);
    const query = normalizeQuery(url.searchParams.get("q") ?? "");

    if (query.length < MIN_QUERY_LENGTH) {
        return fail("bad_request", `Запрос должен быть не короче ${MIN_QUERY_LENGTH} символов`);
    }

    const filter = { $text: { $search: query, $language: "russian" } };

    try {
        const client = await clientPromise;
        const texts = client.db("typikon").collection("texts");

        const [found, total] = await Promise.all([
            texts.find(filter, {
                projection: {
                    alias: 1, name: 1, description: 1, author: 1, translator: 1, type: 1,
                    contentType: 1, readiness: 1, bookId: 1, bookIndex: 1, dneslovId: 1,
                    updatedAt: 1, content: 1,
                    score: { $meta: "textScore" },
                },
            }).sort({ score: { $meta: "textScore" } }).skip(offset).limit(limit).toArray(),
            texts.countDocuments(filter),
        ]);

        const items = found.map(({ content, ...doc }) => ({
            ...textSummary(doc),
            // Фрагмент вырезается из исходного текста — с ударениями, как написано.
            snippet: snippetFor(content, query),
        }));

        return respondCollection(items, { total, limit, offset }, { maxAge: 300 });
    } catch (e) {
        console.error(e);
        return fail("internal", "Поиск не удался");
    }
}
