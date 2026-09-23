import { NextRequest, NextResponse } from "next/server";
import { clientIpFromHeaders, consume } from "@/lib/rateLimit";
import { parseTripRequest } from "@/lib/pilgrimage/trip";
import { buildPlan } from "@/lib/pilgrimage/plan";

// Состав поездки: по дням — чтения, престольные праздники остановок, памяти
// святых маршрута; и список страниц, которые сохранить для чтения без сети.
//
// POST, а не GET: маршрут — сведения личные, и в адресе, который оседает в
// журналах, ему не место. Ничего не записывается: поездка живёт в браузере.

export const dynamic = "force-dynamic";

export const POST = async (request: NextRequest) => {
    // Месяц дней — это тридцать расчётов дня: дорого, и счётчик строже, чем у «рядом».
    const verdict = consume(`trip-plan:${clientIpFromHeaders(request.headers)}`, 10, 60);
    if (!verdict.allowed) {
        return NextResponse.json({ error: `Слишком часто. Повторите через ${verdict.retryAfter} с.` },
            { status: 429, headers: { "Retry-After": String(verdict.retryAfter) } });
    }
    const parsed = parseTripRequest(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    return NextResponse.json(await buildPlan(parsed.value, parsed.days), { headers: { "Cache-Control": "no-store" } });
};
