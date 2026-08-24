import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { issueToken, listTokens } from "@/app/api/api-tokens/service";
import { consume, clientIpFromHeaders } from "@/lib/rateLimit";

// Ключи API в профиле. Ручка своя, сайтовая, а не часть публичного API: ключами
// распоряжаются по сессии, и в /api/v2 им делать нечего.

export async function GET() {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    return NextResponse.json(await listTokens(session.id));
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    // Выпуск ключа — запись в базу и генерация случайных байт; частить незачем.
    const verdict = consume(`api-token-issue:${clientIpFromHeaders(request.headers)}`, 10, 3600);
    if (!verdict.allowed) {
        return NextResponse.json({ error: "Слишком часто. Попробуйте позже." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await issueToken(session.id, typeof body?.name === "string" ? body.name : "");

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    // Открытый ключ уходит один раз и только здесь: в базе лежит лишь его хэш.
    return NextResponse.json({ token: result.token, item: result.item }, {
        status: 200,
        headers: { "Cache-Control": "no-store" },
    });
}
