import { NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { listPersons } from "@/lib/pomyannik/service";
import { makeBackup } from "@/lib/pomyannik/backup";

export const dynamic = "force-dynamic";
export async function GET() {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });
    return new NextResponse(JSON.stringify(makeBackup(await listPersons(session.id)), null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store",
            "Content-Disposition": `attachment; filename="pomyannik-${new Date().toISOString().slice(0, 10)}.json"` },
    });
}
