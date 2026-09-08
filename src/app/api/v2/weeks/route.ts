import clientPromise from "@/lib/mongodb";
import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { readEnum } from "@/lib/api/v2/params";
import { week } from "@/lib/api/v2/serialize";
import {reportError} from "@/lib/reportError";

// Седмицы подвижного круга: Постная и Цветная Триодь.
export const revalidate = 3600;

// «Вне Триоди» — рядовые седмицы года, их пятьдесят три. Ручка их не знала, и
// спросивший получал не отказ, а союз двух других циклов: двадцать седмиц вместо
// пятидесяти трёх, и по виду ответа не отличить.
const CYCLES = ["triodion", "penticostarion", "out-triodion"] as const;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const asked = url.searchParams.get("cycle");
    const cycle = readEnum(url, "cycle", CYCLES);
    // Незнакомый круг — отказ, а не молчаливая подмена. Прежде спросивший
    // `out-triodion` получал союз двух других кругов, и ответ выглядел
    // правдоподобно ровно настолько, чтобы ошибку не заметить.
    if (asked && !cycle) {
        return fail("bad_request", `Круг должен быть одним из: ${CYCLES.join(", ")}`);
    }

    const filter = cycle === "triodion"
        ? { triodion: true }
        : cycle === "penticostarion"
            ? { penticostration: true }
            : cycle === "out-triodion"
                // Рядовые седмицы: ни Триодь постная, ни цветная.
                ? { penticostration: false, triodion: false }
                : { $or: [{ triodion: true }, { penticostration: true }] };

    try {
        const client = await clientPromise;
        const items = await client.db("typikon").collection("weeks")
            .find(filter, { projection: { alias: 1, label: 1, type: 1, value: 1, triodion: 1, penticostration: 1, days: 1 } })
            .toArray();

        // Порядок — ход богослужебного года: подготовительные седмицы (Triodion),
        // затем Великий пост (Fast). По полю value внутри каждого.
        // Рядовые седмицы идут просто по счёту: подготовительных среди них нет,
        // и правило «Triodion раньше прочих» им ничего не даёт.
        const rank = (w: any) => cycle === "out-triodion"
            ? (w.value ?? 0)
            : (w.type === "Triodion" ? 0 : 1) * 100 + (w.value ?? 0);
        items.sort((a, b) => rank(a) - rank(b));

        const serialized = items.map((w) => ({ ...week(w), dayCount: (w.days ?? []).length }));

        return respondCollection(serialized, { total: serialized.length, limit: serialized.length, offset: 0 }, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/weeks/route#GET", source: "api" });
        return fail("internal", "Не удалось получить седмицы");
    }
}
