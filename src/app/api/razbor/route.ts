import { NextResponse } from "next/server";
import { clientIpFromHeaders, consume } from "@/lib/rateLimit";
import { razbor } from "@/lib/razbor/lookup";

// Разбор набранного текста для страницы /razbor.
//
// Своя ручка, а не публичное API: наружу это не документируется, а внутрь
// приходит цельный текст — последование, а то и страница книги.

export const dynamic = "force-dynamic";

// Больше страницы за раз не берём: сличение идёт одним запросом, но ключей в
// нём столько же, сколько строк, и мегабайт положил бы это на ровном месте.
const MAX_LENGTH = 20_000;

const LIMIT = 30;
const WINDOW_SECONDS = 60;

export async function POST(request: Request) {
    const ip = clientIpFromHeaders(request.headers);
    const verdict = consume(`razbor:${ip}`, LIMIT, WINDOW_SECONDS);
    if (!verdict.allowed) {
        return NextResponse.json(
            { error: "Слишком часто. Подождите минуту." },
            { status: 429, headers: { "Retry-After": String(verdict.retryAfter ?? WINDOW_SECONDS) } },
        );
    }

    const body = await request.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text : "";

    if (!text.trim()) {
        return NextResponse.json({ error: "Пустой текст" }, { status: 400 });
    }
    if (text.length > MAX_LENGTH) {
        return NextResponse.json(
            { error: `Больше ${MAX_LENGTH.toLocaleString("ru-RU")} знаков за раз не разбираем` },
            { status: 413 },
        );
    }

    try {
        return NextResponse.json(razbor(text));
    } catch (e) {
        console.error("razbor: не удалось разобрать текст", e);
        return NextResponse.json({ error: "Не удалось разобрать текст" }, { status: 500 });
    }
}
