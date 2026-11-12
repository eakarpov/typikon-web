import {SERVICE_CHOICES} from "@/lib/parish/dayConfig";
import {schedulePeriod} from "@/lib/parish/period";
import { NextRequest, NextResponse } from "next/server";
import { dropEdit, saveEdit, type EditOp } from "@/lib/parish/edits";
import { rightsOn, touchAdmin } from "@/lib/parish/access";
import type { Part } from "@/lib/parish/types";

// Правка расписания — только тому, кто ведёт ЭТОТ храм. Не «вошедшему» и не
// администратору вообще: расписание висит на стенде, и менять его вправе
// приход, а не всякий, кто открыл страницу.

const OPS: EditOp[] = ["time", "title", "cancel", "add", "compose"];

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

    const period=schedulePeriod(String(body.month));
    if(!period||typeof body.date!=="string"||!period.dates.includes(body.date))return NextResponse.json({error:"Дата не входит в выбранный период расписания"},{status:400});

    if(!['utro','vecher','noch','den'].includes(body.part)||body.value?.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.value.time))return NextResponse.json({error:'Проверьте время и часть суток'},{status:400});
    if(['compose','add'].includes(body.op)&&(!Array.isArray(body.value?.services)||!body.value.services.length||body.value.services.length>20||body.value.services.some((key:unknown)=>!SERVICE_CHOICES.some(s=>s[0]===key))))return NextResponse.json({error:'Выберите службы из списка'},{status:400});
    if(body.value?.part&&!['utro','vecher','noch','den'].includes(body.value.part))return NextResponse.json({error:'Неизвестная часть суток'},{status:400});
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
    const removed=await dropEdit(slug,id);
    if(!removed.deletedCount)return NextResponse.json({error:"Правка в этом храме не найдена"},{status:404});
    return NextResponse.json({ ok: true });
}
