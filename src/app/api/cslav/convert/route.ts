import { NextResponse } from "next/server";
import { consume, clientIpFromHeaders } from "@/lib/rateLimit";
import { convertText } from "@/lib/cslav/service";

// Перевод гражданского написания в церковнославянское.
//
// Единственный инструмент раздела «Набор», которому нужен сервер: указатель
// написаний живёт в базе (158 741 ключ), и в браузер его не увезти. Об этом
// прямо сказано на самой странице — прочие инструменты раздела текст никуда не
// отправляют, и общая оговорка раздела не должна вводить в заблуждение.
export const dynamic = "force-dynamic";

// Больше страницы за раз не берём: перевод спрашивает у базы все уникальные
// слова текста разом, и запрос на мегабайт положил бы это на ровном месте.
const MAX_LENGTH = 20_000;

const LIMIT = 30;
const WINDOW_SECONDS = 60;

export async function POST(request: Request) {
    const ip = clientIpFromHeaders(request.headers);
    const verdict = consume(`cslav-convert:${ip}`, LIMIT, WINDOW_SECONDS);

    if (!verdict.allowed) {
        return NextResponse.json(
            { error: "Слишком часто. Подождите немного." },
            { status: 429, headers: { "Retry-After": String(verdict.retryAfter ?? WINDOW_SECONDS) } },
        );
    }

    const body = await request.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text : "";
    const rule = body?.rule !== false;
    const accents = body?.accents !== false;
    const titla = body?.titla === true;

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
        return NextResponse.json(await convertText(text, { rule, accents, titla }));
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Не удалось перевести" }, { status: 500 });
    }
}
