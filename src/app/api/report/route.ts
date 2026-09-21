import {NextRequest, NextResponse} from "next/server";
import {saveReport} from "@/app/api/report/service";
import {getSession} from "@/lib/authorize/sessions";
import {isId, isOptionalText, isSmallObject} from "@/lib/api/bodyLimits";

export async function POST(request: NextRequest) {
    // userId раньше брался из тела запроса как есть — клиент мог прислать
    // произвольный чужой id. Теперь берём из проверенной сессии; без неё
    // отчёт не сохраняем вовсе (фича только для вошедших пользователей).
    const session = await getSession();
    if (!session) {
        return new NextResponse(null, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const selectionOk = typeof body?.selection === "string"
        ? body.selection.length <= 5000
        : isSmallObject(body?.selection, 10000);
    if (!body || !isId(body.textId) || !selectionOk || !isOptionalText(body.correction, 5000)) {
        return new NextResponse(null, { status: 400 });
    }

    await saveReport({
        textId: body.textId, selection: body.selection, correction: body.correction, userId: session.id,
    });

    return NextResponse.json(null, {
        status: 200,
    });
}

export async function DELETE(request: NextRequest) {
    const body = await request.json();

    return NextResponse.json(null, {
        status: 405,
    });
}
