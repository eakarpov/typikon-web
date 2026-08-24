import clientPromise from "@/lib/mongodb";
import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { limitOrFail } from "@/lib/api/v2/rateLimit";
import { readPage } from "@/lib/api/v2/params";
import { book } from "@/lib/api/v2/serialize";

export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const limited = limitOrFail(request);
    if (limited) return limited;

    const { limit, offset } = readPage(new URL(request.url));
    const filter = { public: { $ne: false } };

    try {
        const client = await clientPromise;
        const books = client.db("typikon").collection("books");

        const [items, total] = await Promise.all([
            // texts[] нужен только чтобы посчитать длину — наружу уходит textCount.
            books.find(filter, { projection: { name: 1, author: 1, translator: 1, description: 1, order: 1, texts: 1, updatedAt: 1 } })
                .sort({ order: 1, name: 1 }).skip(offset).limit(limit).toArray(),
            books.countDocuments(filter),
        ]);

        return respondCollection(items.map(book), { total, limit, offset });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить список книг");
    }
}
