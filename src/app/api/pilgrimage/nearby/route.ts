import { NextRequest, NextResponse } from "next/server";
import { clientIpFromHeaders, consume } from "@/lib/rateLimit";
import { nearby } from "@/lib/pilgrimage/nearby";
import { parsePoint } from "@/lib/pilgrimage/summary";

// Что рядом с точкой: престолы, места, святыни.
//
// Точка округляется до километра прежде всего остального (см. parsePoint):
// и ключ кэша, и всё, что ниже, видят уже её, а не подъезд человека.
// День — читателя, а не сервера: от него зависит «ближайший праздник», и в
// первом часу ночи по Москве сервер по UTC живёт ещё во вчерашнем дне.

export const dynamic = "force-dynamic";

const NEARBY_LIMIT = { limit: 30, windowSeconds: 60 };

export const GET = async (request: NextRequest) => {
    const verdict = consume(`nearby:${clientIpFromHeaders(request.headers)}`, NEARBY_LIMIT.limit, NEARBY_LIMIT.windowSeconds);
    if (!verdict.allowed) {
        return NextResponse.json({ error: `Слишком часто. Повторите через ${verdict.retryAfter} с.` },
            { status: 429, headers: { "Retry-After": String(verdict.retryAfter) } });
    }

    const q = request.nextUrl.searchParams;
    const point = parsePoint(q.get("lat"), q.get("lon"), q.get("r"));
    if (!point) return NextResponse.json({ error: "нужны lat и lon" }, { status: 400 });

    const asked = q.get("date") ?? "";
    const today = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : new Date().toISOString().slice(0, 10);

    const result = await nearby(point.lat, point.lon, point.radiusKm, today);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
};
