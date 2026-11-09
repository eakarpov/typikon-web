import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { viewer } from "@/lib/rights-server";
import { onlineSessionFilter, probeService } from "@/lib/admin/status";

export const dynamic = "force-dynamic";
let pending: Promise<unknown> | undefined;
let until = 0;
async function snapshot() {
    const db = (await clientPromise).db("typikon-users");
    const [pdf, statistics, users, onlineIds] = await Promise.all([
        probeService(process.env.PDF_SERVICE_URL || "http://127.0.0.1:3002/pdf", "POST"),
        probeService(process.env.STATS_SERVICE_URL || "http://127.0.0.1:3001/meta", "GET"),
        db.collection("users").countDocuments(),
        db.collection("sessions").distinct("id", onlineSessionFilter()),
    ]);
    return { pdf, statistics, users, online: onlineIds.length, checkedAt: new Date().toISOString() };
}
export async function GET() {
    if (!process.env.SHOW_ADMIN) return new NextResponse(null, { status: 404 });
    const { caps } = await viewer();
    if (process.env.NODE_ENV !== "development" && !caps.has("content")) return new NextResponse(null, { status: 403 });
    try {
        if (!pending || Date.now() >= until) {
            until = Date.now() + 15_000;
            pending = snapshot().catch(error => { pending = undefined; throw error; });
        }
        return NextResponse.json(await pending, { headers: { "Cache-Control": "private, no-store" } });
    } catch { return NextResponse.json({ error: "Не удалось получить состояние" }, { status: 503 }); }
}
