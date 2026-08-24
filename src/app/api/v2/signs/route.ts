import clientPromise from "@/lib/mongodb";
import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { limitOrFail } from "@/lib/api/v2/rateLimit";
import { readPage } from "@/lib/api/v2/params";
import { sign } from "@/lib/api/v2/serialize";

// Знаки Типикона по месяцеслову: месяц и число — по старому стилю.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const limited = limitOrFail(request);
    if (limited) return limited;

    const url = new URL(request.url);
    const { limit, offset } = readPage(url);

    const filter: Record<string, any> = {};
    const month = Number(url.searchParams.get("month"));
    const date = Number(url.searchParams.get("date"));

    if (url.searchParams.has("month")) {
        if (!Number.isInteger(month) || month < 1 || month > 12) {
            return fail("bad_request", "Месяц указывается числом от 1 до 12");
        }
        filter.month = month;
    }
    if (url.searchParams.has("date")) {
        if (!Number.isInteger(date) || date < 1 || date > 31) {
            return fail("bad_request", "Число указывается от 1 до 31");
        }
        filter.date = date;
    }

    try {
        const client = await clientPromise;
        const signs = client.db("typikon").collection("signs");

        const [items, total] = await Promise.all([
            signs.find(filter).sort({ month: 1, date: 1, order: 1 }).skip(offset).limit(limit).toArray(),
            signs.countDocuments(filter),
        ]);

        return respondCollection(items.map(sign), { total, limit, offset });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить знаки");
    }
}
