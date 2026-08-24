import { fail, preflight, respond } from "@/lib/api/v2/http";
import { limitOrFail } from "@/lib/api/v2/rateLimit";
import { getItem } from "@/app/months/[id]/api";
import { month } from "@/lib/api/v2/serialize";

// Месяц со списком своих дней — по одной строке на день, без чтений.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, { params }: { params: { alias: string } }) {
    const limited = limitOrFail(request);
    if (limited) return limited;

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
        });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить месяц");
    }
}
