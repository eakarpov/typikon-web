import { NextRequest, NextResponse } from "next/server";
import { chosenVariant, parseSegment, shortAnswer } from "@/lib/trapeza/core";
import { trapezaDay } from "@/lib/trapeza/store";

// Одна строка о трапезе — для блока на странице чтений.
//
// Ручка, а не серверная вставка: страница чтений ходит в Монгу и обязана
// отвечать быстро, а движок устава живёт своей жизнью и по таймауту молчит
// восемь секунд. Посадив её на движок, мы заставили бы ждать всех ради строки,
// без которой день читается.
//
// Наружу отдаём разобранное, а не ответ движка: там семнадцать килобайт на
// день, и вести их в браузер ради одной строки незачем.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const raw = request.nextUrl.searchParams.get("date");
    const segment = parseSegment(raw);
    if (!segment || segment.kind !== "day") {
        return NextResponse.json({ error: "нужна дата вида 2026-09-04" }, { status: 400 });
    }

    const day = await trapezaDay(segment.date);
    const rules = chosenVariant(day)?.fasting ?? [];
    const answer = shortAnswer(rules);

    return NextResponse.json({
        kind: answer.kind,
        line: answer.line,
        href: `/trapeza/${segment.date}`,
    });
}
