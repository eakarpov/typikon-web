import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { markNote } from "@/lib/pomyannik/zapiski";

/** Отметка принимающего: прочитана, а для длящегося поминовения — окончено. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const what = body?.mark === "finished" ? "finished" : "read";

    const ok = await markNote(session.id, id, what);
    // 404 и «уже отмечено» здесь неразличимы нарочно: по ответу нельзя узнать,
    // существует ли чужая записка.
    if (!ok) return new NextResponse(null, { status: 404 });
    return NextResponse.json({ ok: true });
}
