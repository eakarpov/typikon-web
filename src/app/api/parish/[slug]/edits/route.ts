import { NextRequest, NextResponse } from "next/server";
import { dropEdit, saveEdit, type EditOp } from "@/lib/parish/edits";
import type { Part } from "@/lib/parish/types";

// Правка расписания. Прав пока нет: раздел живёт одним храмом сквозным путём,
// и кто чей приход ведёт — следующая задача. До неё ручка закрыта всюду, кроме
// разработки: расписание висит на стенде, и править его прохожему нельзя.
const allowed = () => process.env.NODE_ENV === "development";

const OPS: EditOp[] = ["time", "title", "cancel", "add"];

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
    if (!allowed()) return NextResponse.json({ error: "нельзя" }, { status: 403 });
    const { slug } = await ctx.params;
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
    });
    return NextResponse.json({ id });
}

export async function DELETE(request: NextRequest) {
    if (!allowed()) return NextResponse.json({ error: "нельзя" }, { status: 403 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "нет id" }, { status: 400 });
    await dropEdit(id);
    return NextResponse.json({ ok: true });
}
