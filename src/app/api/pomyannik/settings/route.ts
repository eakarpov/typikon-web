import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { setBookSettings } from "@/lib/pomyannik/service";

export async function PUT(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });
    const body = await request.json().catch(() => null);
    if (typeof body?.showSignatures !== "boolean") {
        return NextResponse.json({ error: "не разобрали настройку подписей" }, { status: 400 });
    }
    await setBookSettings(session.id, body.showSignatures);
    return NextResponse.json({ showSignatures: body.showSignatures });
}
