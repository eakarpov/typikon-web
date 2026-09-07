import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { listPersons } from "@/lib/pomyannik/service";
import { upcoming } from "@/lib/pomyannik/reckoning";

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const asked = Number(request.nextUrl.searchParams.get("days"));
    const days = Number.isFinite(asked) ? Math.min(400, Math.max(1, Math.round(asked))) : 60;

    const persons = await listPersons(session.id);
    return NextResponse.json({ events: upcoming(persons, undefined, days), days });
}
