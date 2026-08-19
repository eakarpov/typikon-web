import {NextRequest, NextResponse} from "next/server";
import {saveReport} from "@/app/api/report/service";
import {getSession} from "@/lib/authorize/sessions";

export async function POST(request: NextRequest) {
    // userId раньше брался из тела запроса как есть — клиент мог прислать
    // произвольный чужой id. Теперь берём из проверенной сессии; без неё
    // отчёт не сохраняем вовсе (фича только для вошедших пользователей).
    const session = await getSession();
    if (!session) {
        return new NextResponse(null, { status: 401 });
    }

    const body = await request.json();

    await saveReport({ ...body, userId: session.id });

    return NextResponse.json(null, {
        status: 200,
    });
}

export async function DELETE(request: NextRequest) {
    const body = await request.json();

    console.log(body);

    return NextResponse.json(null, {
        status: 405,
    });
}
