import clientPromise from "@/lib/mongodb";
import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { readEnum } from "@/lib/api/v2/params";
import { week } from "@/lib/api/v2/serialize";

// Седмицы подвижного круга: Постная и Цветная Триодь.
export const revalidate = 3600;

const CYCLES = ["triodion", "penticostarion"] as const;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    const cycle = readEnum(new URL(request.url), "cycle", CYCLES);
    const filter = cycle === "triodion"
        ? { triodion: true }
        : cycle === "penticostarion"
            ? { penticostration: true }
            : { $or: [{ triodion: true }, { penticostration: true }] };

    try {
        const client = await clientPromise;
        const items = await client.db("typikon").collection("weeks")
            .find(filter, { projection: { alias: 1, label: 1, type: 1, value: 1, triodion: 1, penticostration: 1, days: 1 } })
            .toArray();

        // Порядок — ход богослужебного года: подготовительные седмицы (Triodion),
        // затем Великий пост (Fast). По полю value внутри каждого.
        const rank = (w: any) => (w.type === "Triodion" ? 0 : 1) * 100 + (w.value ?? 0);
        items.sort((a, b) => rank(a) - rank(b));

        const serialized = items.map((w) => ({ ...week(w), dayCount: (w.days ?? []).length }));

        return respondCollection(serialized, { total: serialized.length, limit: serialized.length, offset: 0 }, { access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить седмицы");
    }
}
