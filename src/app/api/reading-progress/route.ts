import {NextRequest, NextResponse} from "next/server";
import {getSession} from "@/lib/authorize/sessions";
import {normaliseProgress} from "@/lib/personal/progress";
import {forgetProgress, recentProgress, saveProgress} from "@/lib/personal/progressService";
import {consume} from "@/lib/rateLimit";

// Место чтения. Пишет страница чтения — не чаще раза в несколько секунд и только
// у вошедшего; читает страница «Сегодня». Без сессии — 401: хранить чтение
// анонима негде и незачем.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, {status: 401});
    const all = request.nextUrl.searchParams.get("all") === "1";
    return NextResponse.json(await recentProgress(session.id, 20, all), {status: 200});
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, {status: 401});

    // Счётчик по пользователю, а не по адресу: пишет вкладка сама, и сломанный
    // цикл в ней не должен превращаться в поток записей.
    if (!consume(`progress:${session.id}`, 60, 60).allowed) {
        return new NextResponse(null, {status: 429});
    }

    const mark = normaliseProgress(await request.json().catch(() => null));
    if (!mark) return new NextResponse(null, {status: 400});

    await saveProgress(session.id, mark);
    return new NextResponse(null, {status: 204});
}

export async function DELETE(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, {status: 401});
    const textId = request.nextUrl.searchParams.get("textId") ?? "";
    if (!/^[0-9a-f]{24}$/i.test(textId)) return new NextResponse(null, {status: 400});
    await forgetProgress(session.id, textId.toLowerCase());
    return new NextResponse(null, {status: 204});
}
