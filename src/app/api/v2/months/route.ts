import clientPromise from "@/lib/mongodb";
import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { month } from "@/lib/api/v2/serialize";

// Месяцы неподвижного круга. Их всегда двенадцать, поэтому без постраничности.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    try {
        const client = await clientPromise;
        const items = await client.db("typikon").collection("months")
            .find({}, { projection: { alias: 1, value: 1, updatedAt: 1 } })
            .sort({ value: 1 }).toArray();

        return respondCollection(items.map(month), { total: items.length, limit: items.length, offset: 0 }, { access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить месяцы");
    }
}
