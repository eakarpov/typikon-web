import clientPromise from "@/lib/mongodb";
import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { readPage } from "@/lib/api/v2/params";
import { placeSummary } from "@/lib/api/v2/serialize";
import { PLACES } from "@/lib/places/schema";
import { reportError } from "@/lib/reportError";

// Указатель мест — постранично, по алфавиту. Только открытые: скрытые места
// (импорт без русского имени) не показываются и на сайте.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const { limit, offset } = readPage(url);
    const kind = url.searchParams.get("kind");

    try {
        const db = (await clientPromise).db("typikon");
        const filter: Record<string, unknown> = { published: { $ne: false }, ...(kind ? { kind } : {}) };
        const [rows, total] = await Promise.all([
            db.collection(PLACES)
                .find(filter, { projection: { name: 1, slug: 1, alias: 1, kind: 1, status: 1, location: 1, latitude: 1, longitude: 1 } })
                .collation({ locale: "ru" })
                .sort({ name: 1, _id: 1 })
                .skip(offset)
                .limit(limit)
                .toArray(),
            db.collection(PLACES).countDocuments(filter),
        ]);
        return respondCollection(rows.map((r) => placeSummary({ ...r, id: String(r._id) })), { total, limit, offset }, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/places/route#GET", source: "api" });
        return fail("internal", "Не удалось получить места");
    }
}
