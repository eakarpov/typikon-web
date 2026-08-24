import clientPromise from "@/lib/mongodb";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { limitOrFail } from "@/lib/api/v2/rateLimit";
import { week } from "@/lib/api/v2/serialize";

// Седмица со списком дней. Чтения — в /days/{alias} или /calendar/{дата}.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, { params }: { params: { alias: string } }) {
    const limited = limitOrFail(request);
    if (limited) return limited;

    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const doc = await db.collection("weeks").findOne({ alias: params.alias });
        if (!doc) return fail("not_found", `Седмица «${params.alias}» не найдена`);

        const days = await db.collection("days")
            .find({ _id: { $in: doc.days ?? [] } }, { projection: { alias: 1, name: 1, weekIndex: 1 } })
            .toArray();
        days.sort((a, b) => (a.weekIndex ?? 0) - (b.weekIndex ?? 0));

        return respond({
            ...week(doc),
            days: days.map((day) => ({
                id: day._id.toString(),
                alias: day.alias || null,
                name: day.name ?? "",
                weekIndex: day.weekIndex ?? null,
            })),
        });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить седмицу");
    }
}
