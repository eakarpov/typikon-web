import clientPromise from "@/lib/mongodb";
import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { limitOrFail } from "@/lib/api/v2/rateLimit";
import { readEnum, readPage } from "@/lib/api/v2/params";
import { pericope } from "@/lib/api/v2/serialize";

// Зачала: у каждого — источник, книга, номер, диапазоны стихов и дни, когда читается.
export const revalidate = 3600;

const SOURCES = ["gospel", "apostle", "paremia"] as const;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const limited = limitOrFail(request);
    if (limited) return limited;

    const url = new URL(request.url);
    const { limit, offset } = readPage(url);

    const filter: Record<string, any> = {};
    const source = readEnum(url, "source", SOURCES);
    if (source) filter.source = source;

    const bookSlug = url.searchParams.get("book");
    if (bookSlug) filter.bookSlug = bookSlug;

    try {
        const client = await clientPromise;
        const pericopes = client.db("typikon").collection("pericopes");

        const [items, total] = await Promise.all([
            pericopes.find(filter).sort({ source: 1, number: 1 }).skip(offset).limit(limit).toArray(),
            pericopes.countDocuments(filter),
        ]);

        return respondCollection(items.map(pericope), { total, limit, offset });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить зачала");
    }
}
