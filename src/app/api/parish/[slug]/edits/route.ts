import { NextRequest, NextResponse } from "next/server";
import { dropEdit, saveEdit, type EditOp } from "@/lib/parish/edits";
import { rightsOn, touchAdmin } from "@/lib/parish/access";
import type { Part } from "@/lib/parish/types";

// Правка расписания — только тому, кто ведёт ЭТОТ храм. Не «вошедшему» и не
// администратору вообще: расписание висит на стенде, и менять его вправе
// приход, а не всякий, кто открыл страницу.

const OPS: EditOp[] = ["time", "title", "cancel", "add"];

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
    const { slug } = await ctx.params;
    const rights = await rightsOn(slug);
    if (!rights.canEdit) {
        return NextResponse.json(
            { error: rights.userId ? "этот храм ведёте не вы" : "войдите" },
            { status: rights.userId ? 403 : 401 });
    }
    const body = await request.json().catch(() => null);

    if (!body?.month || !body?.date || !body?.part || !body?.gatheringKey
        || !OPS.includes(body.op)) {
        return NextResponse.json({ error: "не хватает полей" }, { status: 400 });
    }

    const id = await saveEdit({
        parishSlug: slug,
        month: String(body.month),
        date: String(body.date),
        part: body.part as Part,
        gatheringKey: String(body.gatheringKey),
        op: body.op as EditOp,
        value: body.value ?? {},
        baseline: body.baseline ?? {},
        note: body.note ? String(body.note) : undefined,
        // КТО ПРАВИЛ — записывается всегда: приход должен понимать, чьей рукой
        // изменено его расписание
        createdBy: rights.userId ?? undefined,
    });
    // правка — дело, и она подтверждает право (parish/access.confirmedAt)
    if (rights.userId) await touchAdmin(slug, rights.userId);
    return NextResponse.json({ id });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
    const { slug } = await ctx.params;
    if (!(await rightsOn(slug)).canEdit) {
        return NextResponse.json({ error: "нельзя" }, { status: 403 });
    }
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "нет id" }, { status: 400 });
    await dropEdit(id);
    return NextResponse.json({ ok: true });
}
