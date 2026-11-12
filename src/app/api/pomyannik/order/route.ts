import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { reorderPersons } from "@/lib/pomyannik/service";
import { MAX_PERSONS } from "@/lib/pomyannik/types";

export async function PUT(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!Array.isArray(body?.ids) || body.ids.length > MAX_PERSONS) {
        return NextResponse.json({ error: "не разобрали порядок имён" }, { status: 400 });
    }
    if (!await reorderPersons(session.id, body.ids)) {
        return NextResponse.json({ error: "Список изменился. Обновите страницу и повторите перестановку." }, { status: 409 });
    }
    return NextResponse.json({ saved: true });
}
