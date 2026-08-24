import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { getItem } from "@/app/months/[id]/api";
import { month } from "@/lib/api/v2/serialize";

// Месяц со списком своих дней — по одной строке на день, без чтений.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, { params }: { params: { alias: string } }) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    try {
        const [doc, error] = await getItem(params.alias);

        if (error) return fail("internal", "Не удалось получить месяц");
        if (!doc) return fail("not_found", `Месяц «${params.alias}» не найден`);

        return respond({
            ...month(doc),
            days: (doc.days ?? []).map((day: any) => ({
                id: day._id?.toString() ?? day.id ?? null,
                alias: day.alias || null,
                name: day.name ?? "",
                monthIndex: day.monthIndex ?? null,
            })),
        }, { access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить месяц");
    }
}
