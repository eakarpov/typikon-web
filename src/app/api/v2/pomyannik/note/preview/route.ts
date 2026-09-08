import { authorizeUser } from "@/lib/api/v2/user";
import { fail, respondPrivate } from "@/lib/api/v2/http";
import { noteKindInfo, noteName } from "@/lib/api/v2/serialize";
import { listPersons } from "@/lib/pomyannik/service";
import { slavonicNames } from "@/lib/pomyannik/slavonic";
import { NoteError, snapshot, spanOf, validateNote } from "@/lib/pomyannik/note";
import { NOTE_KIND_BY_KEY, type NoteKind } from "@/lib/pomyannik/types";
import { reportError } from "@/lib/reportError";

// ЗАПИСКА ДО ПОДАЧИ: тот самый лист, только ещё не отданный.
//
// Ручка нужна затем, что церковнославянский родительный падеж на телефоне не
// вывести: за ним стоит словарь личных имён и склонение по схеме, и ни того ни
// другого в приложении нет и не будет.
//
// Отдаёт РОВНО ТО ЖЕ, что кладёт `sendNote`, и тем же `snapshot` — иначе
// предпросмотр и поданное разойдутся на первой же правке, и человек отдаст не
// то, что видел.
//
// ИМЕНА БЕРУТСЯ ИЗ ПОМЯННИКА по их идентификаторам, а не из тела запроса. То же
// правило, что и у подачи: иначе всякий слал бы произвольный текст под видом
// имени, и проверка имён, ради которой всё затевалось, не значила бы ничего.
//
// Отказ проверки — не поломка, а ответ: «панихида — заупокойное поминовение,
// живых в него не вписывают: Николай». Его и отдаём словами сервера.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const body = await request.json().catch(() => null);
    const kind = String((body as any)?.kind ?? "");
    const ids: string[] = Array.isArray((body as any)?.personIds)
        ? (body as any).personIds.map(String)
        : [];

    const info = NOTE_KIND_BY_KEY[kind];
    if (!info) return fail("bad_request", "Такого поминовения мы не знаем");
    if (!ids.length) return fail("bad_request", "В записке нет ни одного имени");

    try {
        const mine = await listPersons(access.userId);
        const chosen = mine.filter(person => person.id && ids.includes(person.id));
        if (!chosen.length) return fail("bad_request", "В записке нет ни одного имени");

        const slavonic = await slavonicNames(chosen.map(p => p.churchName || p.name));
        const names = validateNote(
            kind,
            chosen.map(p => snapshot(p, slavonic[p.churchName || p.name] ?? null)),
        );

        return respondPrivate({
            kind: noteKindInfo(info),
            // Срок длящегося поминовения считается от дня подачи, а подача ещё
            // не случилась: здесь он показан на сегодня и на день подачи сдвинется.
            span: spanOf(kind as NoteKind, new Date()),
            names: names.map(noteName),
        }, { access });
    } catch (e) {
        if (e instanceof NoteError) return fail("bad_request", e.message);
        reportError(e, { where: "app/api/v2/pomyannik/note/preview/route#POST", source: "api" });
        return fail("internal", "Не удалось собрать записку");
    }
}
