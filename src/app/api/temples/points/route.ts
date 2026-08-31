import { NextRequest, NextResponse } from "next/server";
import { getTempleCells, type MapView } from "@/lib/temples";

// Что рисовать на карте.
//
// Отдаём СЕТКУ на любом приближении: клетка размером всегда в семьдесят восемь
// экранных точек, и разбирается она по содержимому — один храм в клетке идёт
// сам собою, с именем и адресом, несколько идут числом. Порога по масштабу
// нет намеренно: решает плотность, а не приближение, и на девятом шаге посреди
// Владимирской области отдельные точки слипаются ничуть не меньше, чем на
// четвёртом.
//
// Поля однобуквенные не из щегольства: на десятках тысяч записей разница между
// «latitude» и «y» — это десятки килобайт.

export const dynamic = "force-dynamic";

const parseBbox = (raw: string | null): MapView["bbox"] => {
    if (!raw) return undefined;
    const parts = raw.split(",").map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) return undefined;
    return parts as [number, number, number, number];
};

export const GET = async (request: NextRequest) => {
    const params = request.nextUrl.searchParams;
    const cells = await getTempleCells(
        { query: params.get("q") ?? undefined, dedication: params.get("dedication") ?? undefined },
        { bbox: parseBbox(params.get("bbox")), zoom: Number(params.get("zoom")) || undefined },
    );

    return NextResponse.json({
        cells,
        total: cells.reduce((sum, c) => sum + c.n, 0),
        alone: cells.filter((c) => c.n === 1).length,
    });
};
