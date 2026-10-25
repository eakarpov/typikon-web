import { NextResponse } from "next/server";
import { currentCacheVersion } from "@/lib/cacheVersion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public metadata: no account, API key, database connection or personal data.
export async function GET() {
    try {
        return NextResponse.json({ version: await currentCacheVersion() }, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch {
        return NextResponse.json({ status: "unavailable" }, {
            status: 503, headers: { "Cache-Control": "no-store" },
        });
    }
}
