import { authorizeUser } from "@/lib/api/v2/user";
import { fail, respondPrivate, respondPrivateCollection } from "@/lib/api/v2/http";
import { readPage } from "@/lib/api/v2/params";
import { zapiska as serializeNote } from "@/lib/api/v2/serialize";
import { commemoratorByCode, commemoratorBySlug } from "@/lib/pomyannik/commemorators";
import { listPersons } from "@/lib/pomyannik/service";
import { slavonicNames } from "@/lib/pomyannik/slavonic";
import { NoteError } from "@/lib/pomyannik/note";
import { notesFrom, sendNote } from "@/lib/pomyannik/zapiski";
import { NOTE_KIND_BY_KEY } from "@/lib/pomyannik/types";
import { consume } from "@/lib/rateLimit";
import { reportError } from "@/lib/reportError";

// ПОДАЧА ЗАПИСКИ СВЯЩЕННИКУ И СПИСОК ПОДАННОГО.
//
// Вход обязателен, и не ради нас: без него открытая страница священника — это
// открытый ящик, куда пишет кто угодно и сколько угодно, а разгребать его
// придётся тому, кто согласился поминать. Отсюда же и свой счётчик, отдельный
// от общего лимита ключа: тот считает запросы, а этот — записки.
//
// Приход по коду-приглашению, какой священник раздаёт сам, либо по слугу его
// открытой страницы. Храма в этом нет вовсе: записка у ящика — дело денежное, и
// привязка приёма к приходу потянула бы за собою счёт и отчисления. Оплат у нас
// нет, и записку принимает священник, а не храм.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const { limit, offset } = readPage(new URL(request.url));

    try {
        const notes = await notesFrom(access.userId);
        return respondPrivateCollection(
            notes.slice(offset, offset + limit).map(serializeNote),
            { total: notes.length, limit, offset },
            { access },
        );
    } catch (e) {
        reportError(e, { where: "app/api/v2/pomyannik/zapiski/route#GET", source: "api" });
        return fail("internal", "Не удалось открыть поданные записки");
    }
}

export async function POST(request: Request) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const rate = consume(`zapiska:${access.userId}`, 20, 3600);
    if (!rate.allowed) {
        return fail("rate_limited", "Слишком часто; попробуйте позже", {
            "Retry-After": String(rate.retryAfter),
        });
    }

    const body = await request.json().catch(() => null);
    const kind = String((body as any)?.kind ?? "");
    const ids: string[] = Array.isArray((body as any)?.personIds)
        ? (body as any).personIds.map(String)
        : [];
    const code = String((body as any)?.code ?? "").trim();
    const slug = String((body as any)?.slug ?? "").trim();

    if (!NOTE_KIND_BY_KEY[kind]) return fail("bad_request", "Такого поминовения мы не знаем");

    try {
        const to = code ? await commemoratorByCode(code)
                 : slug ? await commemoratorBySlug(slug)
                 : null;
        if (!to) return fail("not_found", "Приём не найден");
        if (to.userId === access.userId) return fail("bad_request", "Себе записку не подают");

        // Священник мог оставить только часть видов: пустой перечень значит
        // «принимаю всё», непустой — ровно то, что в нём названо.
        if (to.accepts.length && !to.accepts.includes(kind as never)) {
            return fail("bad_request", "Этого поминовения он не принимает");
        }

        const mine = await listPersons(access.userId);
        const chosen = mine.filter(person => person.id && ids.includes(person.id));
        if (!chosen.length) return fail("bad_request", "В записке нет ни одного имени");

        const slavonic = await slavonicNames(chosen.map(p => p.churchName || p.name));
        const note = await sendNote(access.userId, to.userId, kind as never, chosen, slavonic);

        return respondPrivate(
            { note: serializeNote(note), to: { title: to.title } },
            { access, status: 201 },
        );
    } catch (e) {
        if (e instanceof NoteError) return fail("bad_request", e.message);
        reportError(e, { where: "app/api/v2/pomyannik/zapiski/route#POST", source: "api" });
        return fail("internal", "Не удалось подать записку");
    }
}
