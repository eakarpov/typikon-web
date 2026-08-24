import clientPromise from "@/lib/mongodb";
import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { readDate, readEnum, readPage } from "@/lib/api/v2/params";
import { textSummary } from "@/lib/api/v2/serialize";
import { TextReadiness } from "@/utils/texts";
import { ObjectId } from "mongodb";

// Список текстов. Тело текста здесь не отдаётся — за ним в карточку: именно оно
// раздувало ответы v1 до сотни килобайт на три записи.
export const revalidate = 3600;

const READINESS = Object.values(TextReadiness);

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const { limit, offset } = readPage(url);

    const filter: Record<string, any> = {};

    const bookId = url.searchParams.get("book");
    if (bookId) {
        if (!ObjectId.isValid(bookId)) {
            return fail("bad_request", "Параметр book должен быть идентификатором книги");
        }
        filter.bookId = new ObjectId(bookId);
    }

    const readiness = readEnum(url, "readiness", READINESS);
    if (readiness) filter.readiness = readiness;

    const updatedSince = readDate(url, "updatedSince");
    if (updatedSince) filter.updatedAt = { $gte: updatedSince };

    const dneslovId = url.searchParams.get("saint");
    if (dneslovId) filter.dneslovId = dneslovId;

    try {
        const client = await clientPromise;
        const texts = client.db("typikon").collection("texts");

        const [items, total] = await Promise.all([
            texts.find(filter, {
                projection: {
                    alias: 1, name: 1, description: 1, author: 1, translator: 1, type: 1,
                    contentType: 1, readiness: 1, bookId: 1, bookIndex: 1, dneslovId: 1, updatedAt: 1,
                },
            }).sort({ bookIndex: 1, _id: 1 }).skip(offset).limit(limit).toArray(),
            texts.countDocuments(filter),
        ]);

        return respondCollection(items.map(textSummary), { total, limit, offset }, { access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить список текстов");
    }
}
