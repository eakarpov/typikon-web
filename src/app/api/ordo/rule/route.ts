import { NextResponse } from "next/server";
import { ordoRule } from "@/lib/ordo";

// Текст файла правил — для «лестницы», объясняющей собранную службу.
//
// Внутренняя ручка, не часть публичного API: она проксирует к службе сборки,
// которая слушает только 127.0.0.1. Путь проверяется дважды — здесь и там.
// Дублируем намеренно: проверка на той стороне защищает саму службу, а эта —
// на случай, если службу однажды подменят или переставят.
export const dynamic = "force-dynamic";

const ALLOWED = /^rules\/[A-Za-z0-9_\-\/]+\.yaml$/;

export async function GET(request: Request) {
    const path = new URL(request.url).searchParams.get("path") ?? "";

    // Ни «..», ни абсолютных путей, ни чего-либо вне rules/**.yaml.
    if (!ALLOWED.test(path) || path.includes("..")) {
        return NextResponse.json({ error: "Так путь к правилу не выглядит" }, { status: 400 });
    }

    const rule = await ordoRule(path);
    if (!rule) {
        return NextResponse.json({ error: "Правило не найдено" }, { status: 404 });
    }
    return NextResponse.json(rule, { headers: { "Cache-Control": "private, max-age=300" } });
}
