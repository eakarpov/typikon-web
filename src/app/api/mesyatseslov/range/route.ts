import { NextResponse } from "next/server";
import { parseCivilDate } from "@/lib/menology";
import { getCalendarUstavy, loadCalendarRange } from "@/lib/menologyData";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const params = new URL(request.url).searchParams;
    const ustav = params.get("ustav") ?? "";
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    const first = parseCivilDate(from);
    const last = parseCivilDate(to);
    if (first == null || last == null || last < first || last - first >= 31) {
        return NextResponse.json({ error: "Укажите диапазон от 1 до 31 дня" }, { status: 400 });
    }
    const ustavy = await getCalendarUstavy().catch(() => null);
    if (!ustavy) return NextResponse.json({ error: "Список уставов недоступен" }, { status: 503 });
    if (!ustavy.some(option => option.ustav === ustav)) {
        return NextResponse.json({ error: "Устав не найден" }, { status: 404 });
    }
    const result = await loadCalendarRange(ustav, from, to);
    return result ? NextResponse.json(result) : NextResponse.json({ error: "Дни не загрузились" }, { status: 503 });
}
