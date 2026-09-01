import { NextRequest, NextResponse } from "next/server";
import { addAdmin, removeAdmin, rightsOn } from "@/lib/parish/access";

// Кого приход зовёт вести своё расписание. Зовёт тот, кто уже ведёт: первого
// заводит администратор сайта, дальше приход растит себя сам.
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
    const { slug } = await ctx.params;
    const rights = await rightsOn(slug);
    if (!rights.canInvite) {
        return NextResponse.json({ error: "нельзя" }, { status: rights.userId ? 403 : 401 });
    }
    const body = await request.json().catch(() => null);
    const userId = String(body?.userId ?? "").trim();
    if (!userId) return NextResponse.json({ error: "нет userId" }, { status: 400 });

    if (body?.remove) {
        const ok = await removeAdmin(slug, userId);
        // ПОСЛЕДНЕГО НЕ СНИМАЕМ: храм без ведущего никто уже не поправит
        return ok
            ? NextResponse.json({ ok: true })
            : NextResponse.json(
                { error: "это последний ведущий храма — сперва позовите преемника" },
                { status: 409 });
    }
    await addAdmin(slug, userId, rights.userId ?? undefined);
    return NextResponse.json({ ok: true });
}
