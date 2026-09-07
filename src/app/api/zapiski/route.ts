import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { commemoratorByCode, commemoratorBySlug } from "@/lib/pomyannik/commemorators";
import { listPersons } from "@/lib/pomyannik/service";
import { slavonicNames } from "@/lib/pomyannik/slavonic";
import { NoteError } from "@/lib/pomyannik/note";
import { notesFrom, sendNote } from "@/lib/pomyannik/zapiski";
import { NOTE_KIND_BY_KEY } from "@/lib/pomyannik/types";
import { consume } from "@/lib/rateLimit";

// ПОДАЧА ЗАПИСКИ.
//
// ВХОД ОБЯЗАТЕЛЕН. Без него открытая страница священника — это открытый ящик,
// куда пишет кто угодно и сколько угодно, а разгребать его придётся тому, кто
// согласился поминать. Барьер здесь стоит не ради нас.
//
// Имена берутся ИЗ ПОМЯННИКА подающего по их идентификаторам, а не из тела
// запроса: иначе всякий слал бы священнику произвольный текст под видом имени,
// и проверка имён, ради которой всё и затевалось, не значила бы ничего.

export async function GET() {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });
    return NextResponse.json(await notesFrom(session.id));
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const rate = consume(`zapiska:${session.id}`, 20, 3600);
    if (!rate.allowed) {
        return NextResponse.json({ error: "слишком часто; попробуйте позже" },
            { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    }

    const body = await request.json().catch(() => null);
    const kind = String(body?.kind ?? "");
    const ids: string[] = Array.isArray(body?.personIds) ? body.personIds.map(String) : [];
    const code = String(body?.code ?? "").trim();
    const slug = String(body?.slug ?? "").trim();

    if (!NOTE_KIND_BY_KEY[kind]) {
        return NextResponse.json({ error: "такого поминовения мы не знаем" }, { status: 400 });
    }

    const to = code ? await commemoratorByCode(code)
             : slug ? await commemoratorBySlug(slug)
             : null;
    if (!to) return NextResponse.json({ error: "приём не найден" }, { status: 404 });
    if (to.userId === session.id) {
        return NextResponse.json({ error: "себе записку не подают" }, { status: 400 });
    }
    // Священник мог оставить только часть видов поминовения: пустой перечень
    // значит «принимаю всё», а непустой — ровно то, что в нём названо.
    if (to.accepts.length && !to.accepts.includes(kind as never)) {
        return NextResponse.json(
            { error: "этого поминовения он не принимает" }, { status: 400 });
    }

    const mine = await listPersons(session.id);
    const chosen = mine.filter(p => p.id && ids.includes(p.id));
    if (!chosen.length) {
        return NextResponse.json({ error: "в записке нет ни одного имени" }, { status: 400 });
    }

    const slavonic = await slavonicNames(chosen.map(p => p.churchName || p.name));

    try {
        const note = await sendNote(session.id, to.userId, kind as never, chosen, slavonic);
        return NextResponse.json({ note, to: { title: to.title } }, { status: 201 });
    } catch (e) {
        if (e instanceof NoteError) {
            return NextResponse.json({ error: e.message }, { status: 400 });
        }
        throw e;
    }
}
