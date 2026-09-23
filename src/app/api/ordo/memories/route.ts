import { NextResponse } from "next/server";
import { ordoMemorySearch } from "@/lib/ordo";

// Память для переноса — поиск по имени для страницы суточного круга.
//
// Внутренняя ручка, не часть публичного API: служба сборки слушает только
// 127.0.0.1, и ходит к ней сайт.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
    if (q.length < 3 || q.length > 80) {
        return NextResponse.json({ error: "Нужно от 3 до 80 знаков" }, { status: 400 });
    }
    const found = await ordoMemorySearch(q);
    if (!found) {
        return NextResponse.json({ error: "Служба устава не отвечает" }, { status: 503 });
    }
    return NextResponse.json(found, { headers: { "Cache-Control": "private, max-age=300" } });
}
