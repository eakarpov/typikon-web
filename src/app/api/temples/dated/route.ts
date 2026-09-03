import { NextRequest, NextResponse } from "next/server";
import { datedTemplesOf, DIFFUSION_LIMIT } from "@/lib/temples";

// Датированные храмы одного посвящения — для оси времени на карте.
//
// ЧЕМ ЭТА РУЧКА ОТЛИЧАЕТСЯ ОТ СОСЕДНЕЙ (points). Та отдаёт гнёзда по видимой
// рамке и пересчитывается при каждом движении карты; эта отдаёт все точки
// разом и один раз. Разница не в лени, а в том, что ползунок времени обязан
// переставляться мгновенно: сходить на сервер за каждый полувек — это
// пятнадцать запросов на одно нажатие «проиграть».
//
// Поля однобуквенные по той же причине, что и там: на сотнях записей с именами
// разница между «longitude» и «x» — это килобайты на каждый показ.

export const dynamic = "force-dynamic";

export const GET = async (request: NextRequest) => {
    const dedication = request.nextUrl.searchParams.get("dedication")?.trim();

    // Без посвящения ручка молчит намеренно: весь каталог датированных — это
    // восемь тысяч точек вперемешку, и на одной шкале они не читаются. Отбор
    // задаёт вопрос, а без вопроса ответ был бы просто тяжёлым.
    if (!dedication) {
        return NextResponse.json(
            { error: "Нужно посвящение: ?dedication=slug" },
            { status: 400 },
        );
    }

    const points = await datedTemplesOf(dedication);

    return NextResponse.json({
        points,
        // Упёрлись в потолок — говорим об этом, а не молча показываем часть.
        truncated: points.length >= DIFFUSION_LIMIT,
    });
};
