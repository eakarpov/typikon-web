import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { diagnose, solve, verdict } from "@/lib/dating";
import { asked, ignoredParams, numeric, readRecord } from "@/lib/datingRecord";
import { chronologyAnswer } from "@/lib/api/v2/serialize";

// Разбор летописной датировки перебором.
//
// Ручка без базы: считает @/utils/chronology, перебирает @/lib/dating, и ни то
// ни другое никуда не ходит. Отсюда и её место в раздаче доступа — «calendar»:
// пасхалия и круги это тот же календарь, только на восемь веков назад.
//
// Отвечает не «вот год», а «вот что уцелело и что чему противоречит». Запись,
// сходящаяся на одном годе, и запись, не сходящаяся ни на одном, — оба
// законных ответа, и второй не менее полезен: он значит, что в источнике описка.
export const revalidate = 0;

/**
 * Промежуток перебора по умолчанию — тот же, что у формы на сайте: от крещения
 * Руси до конца допетровского счёта. Именно в нём лежат записи, ради которых
 * решатель и написан, и брать шире значит перебирать заведомо чужое.
 *
 * Границы вообще — от первого года до двадцать первого века; шире тысячи лет за
 * раз не считаем: перебор растёт линейно, а ответ от ширины не выигрывает.
 */
const DEFAULT_FROM = 988;
const DEFAULT_TO = 1700;
const FIRST_AD = 1;
const LAST_AD = 2100;
const MAX_SPAN = 1200;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const params: Record<string, string | undefined> = {};
    url.searchParams.forEach((value, key) => {
        params[key] = value;
    });

    const record = readRecord(params);
    if (!asked(record)) {
        return fail(
            "bad_request",
            "Не названо ни одного условия. Укажите хотя бы лето, индикт, круг "
                + "Солнцу, круг Луне, вруцелето, основание, эпакту, ключ границ "
                + "или день недели.",
        );
    }

    const from = numeric(params.from, FIRST_AD, LAST_AD) ?? DEFAULT_FROM;
    const to = numeric(params.to, FIRST_AD, LAST_AD) ?? DEFAULT_TO;
    if (to < from) return fail("bad_request", "Конец промежутка раньше его начала");
    if (to - from > MAX_SPAN) {
        return fail("bad_request", `Промежуток шире ${MAX_SPAN} лет: сузьте from и to`);
    }

    const result = solve(record, from, to);
    // Разбор считаем только тогда, когда есть что разбирать: перебор с
    // выброшенным условием стоит столько же, сколько сам перебор, и городить
    // его ради записи, которая и так сошлась, незачем.
    const fixes = result.survivors.length === 0 ? diagnose(record, from, to) : [];

    return respond(
        chronologyAnswer(
            record,
            { from, to },
            result,
            verdict(result),
            fixes,
            ignoredParams(params, record),
        ),
        { access, maxAge: 0 },
    );
}
