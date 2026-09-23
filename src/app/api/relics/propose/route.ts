import { NextRequest, NextResponse } from "next/server";
import { viewer } from "@/lib/rights-server";
import { clientIpFromHeaders, consume } from "@/lib/rateLimit";
import { validateRelic } from "@/lib/pilgrimage/relics";
import { createRelic, inputFrom } from "@/lib/pilgrimage/relicsStore";

// Предложить святыню — всякому вошедшему. Запись ложится «ждёт разбора» и не
// видна никому, кроме разбирающего, пока её не примут: источник проверяет
// человек, а не форма.

export const POST = async (request: NextRequest) => {
    const { userId } = await viewer();
    if (!userId) return NextResponse.json({ errors: ["войдите, чтобы предложить запись"] }, { status: 401 });

    const verdict = consume(`relic-propose:${userId}:${clientIpFromHeaders(request.headers)}`, 10, 3600);
    if (!verdict.allowed) {
        return NextResponse.json({ errors: [`Слишком часто. Повторите через ${verdict.retryAfter} с.`] },
            { status: 429, headers: { "Retry-After": String(verdict.retryAfter) } });
    }

    const checked = validateRelic(await inputFrom(await request.json().catch(() => null)));
    if (!checked.ok) return NextResponse.json({ errors: checked.errors }, { status: 400 });

    const saved = await createRelic(checked.value, userId, "pending");
    if ("error" in saved) return NextResponse.json({ errors: [saved.error] }, { status: 400 });
    return NextResponse.json({ ok: true });
};
