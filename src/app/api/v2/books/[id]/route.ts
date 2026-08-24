import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { limitOrFail } from "@/lib/api/v2/rateLimit";
import { readPage } from "@/lib/api/v2/params";
import { book, textSummary } from "@/lib/api/v2/serialize";

// Книга со списком своих текстов. Тексты постранично: в «Толковом апостоле» их 363,
// и отдавать их все одним ответом незачем.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const limited = limitOrFail(request);
    if (limited) return limited;

    if (!ObjectId.isValid(params.id)) {
        return fail("bad_request", "Идентификатор книги указан неверно");
    }

    const { limit, offset } = readPage(new URL(request.url));

    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const doc = await db.collection("books").findOne({ _id: new ObjectId(params.id), public: { $ne: false } });
        if (!doc) return fail("not_found", "Книга не найдена");

        const filter = { bookId: doc._id };
        const [texts, total] = await Promise.all([
            db.collection("texts").find(filter, {
                projection: {
                    alias: 1, name: 1, description: 1, author: 1, translator: 1, type: 1,
                    contentType: 1, readiness: 1, bookId: 1, bookIndex: 1, dneslovId: 1, updatedAt: 1,
                },
            }).sort({ bookIndex: 1, _id: 1 }).skip(offset).limit(limit).toArray(),
            db.collection("texts").countDocuments(filter),
        ]);

        return respond({
            ...book(doc),
            texts: { items: texts.map(textSummary), total, limit, offset },
        });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить книгу");
    }
}
