import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { listTrash, restoreDeletedPerson, TooManyPersonsError } from "@/lib/pomyannik/service";
export const dynamic = "force-dynamic";
export async function GET() {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });
    return NextResponse.json(await listTrash(session.id), { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });
    const body = await request.json().catch(() => null);
    if (typeof body?.id !== "string") return NextResponse.json({ error: "Не указана запись." }, { status: 400 });
    try {
        if (!await restoreDeletedPerson(session.id, body.id)) return NextResponse.json({ error: "Запись в вашей корзине не найдена." }, { status: 404 });
        return NextResponse.json({ restored: true });
    } catch (e) {
        if (e instanceof TooManyPersonsError) return NextResponse.json({ error: e.message }, { status: 409 });
        throw e;
    }
}
