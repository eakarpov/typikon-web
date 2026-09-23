import { NextRequest, NextResponse } from "next/server";
import { clientIpFromHeaders, consume } from "@/lib/rateLimit";
import { getTemples } from "@/lib/temples";
import { placesIndex } from "@/lib/places/query";
import { matches } from "@/lib/places/search";

// Остановки поездки: храмы и места по имени. Храмы ищутся тем же условием,
// что указатель (@/lib/temples#getTemples), места — тем же сличением, что
// указатель мест, — чтобы находилось одно и то же, где ни ищи.

export const dynamic = "force-dynamic";

export const GET = async (request: NextRequest) => {
    const verdict = consume(`trip-search:${clientIpFromHeaders(request.headers)}`, 60, 60);
    if (!verdict.allowed) return NextResponse.json({ error: "Слишком часто" }, { status: 429 });

    const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
    if (q.length < 2) return NextResponse.json({ items: [] });

    const [temples, places] = await Promise.all([getTemples({ query: q }), placesIndex()]);
    const items = [
        ...temples.items.slice(0, 12).map((t) => ({
            kind: "temple" as const, slug: t.slug, name: t.name, note: t.place ?? null,
        })),
        ...places.filter((p) => p.slug && matches(p.haystack, q)).slice(0, 6).map((p) => ({
            kind: "place" as const, slug: p.slug!, name: p.name, note: "место",
        })),
    ];
    return NextResponse.json({ items });
};
