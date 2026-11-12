import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { setReadingPlace } from "@/lib/pomyannik/service";
import { cleanReadingPlace } from "@/lib/pomyannik/reader";

export async function PUT(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });
    const body = await request.json().catch(() => undefined);
    const place = cleanReadingPlace(body?.place);
    if (!body || (body.place !== null && !place)) return NextResponse.json({ error: "Не удалось разобрать место чтения." }, { status: 400 });
    if (!await setReadingPlace(session.id, place)) return NextResponse.json({ error: "Имя больше не найдено в вашем помяннике." }, { status: 404 });
    return NextResponse.json({ saved: true }, { headers: { "Cache-Control": "private, no-store" } });
}
