import { NextResponse } from "next/server";
import { consume, clientIpFromHeaders } from "@/lib/rateLimit";
import { markText } from "@/lib/accents/service";
import type { Genre } from "@/lib/accents/mark";

// Разметка текста для страниц сайта: /accents и подсказка в отекстовке.
//
// Своя ручка, а не публичная /api/v2/accents: там кап в двести слов за запрос и
// метрика ключей, а здесь нужен цельный текст — абзац, а то и страница. Наружу она
// не документируется и в OpenAPI не входит.
export const dynamic = "force-dynamic";

// Больше страницы за раз не берём: разметка тянет из базы все уникальные слова
// текста, и запрос на мегабайт положил бы это на ровном месте.
const MAX_LENGTH = 20_000;

// Частота — как у поиска: задача не защититься от злоумышленника, а не дать одному
// клиенту занять собой всю базу кривым циклом.
const LIMIT = 30;
const WINDOW_SECONDS = 60;

export async function POST(request: Request) {
    const ip = clientIpFromHeaders(request.headers);
    const verdict = consume(`accents-mark:${ip}`, LIMIT, WINDOW_SECONDS);

    if (!verdict.allowed) {
        return NextResponse.json(
            { error: "Слишком часто. Подождите немного." },
            { status: 429, headers: { "Retry-After": String(verdict.retryAfter ?? WINDOW_SECONDS) } },
        );
    }

    const body = await request.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text : "";
    const genre: Genre = body?.genre === "chant" ? "chant" : "reading";

    if (!text.trim()) {
        return NextResponse.json({ error: "Пустой текст" }, { status: 400 });
    }
    if (text.length > MAX_LENGTH) {
        return NextResponse.json(
            { error: `Слишком длинный текст: ${text.length} знаков, можно до ${MAX_LENGTH}` },
            { status: 400 },
        );
    }

    try {
        return NextResponse.json(await markText(text, genre));
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Не удалось разметить" }, { status: 500 });
    }
}
