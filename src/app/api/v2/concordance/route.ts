import clientPromise from "@/lib/mongodb";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { concordanceFor, parseRef } from "@/lib/bible/concordance";
import { publicEditions } from "@/lib/bible/query";
import { bibleEdition } from "@/lib/api/v2/serialize";
import { reportError } from "@/lib/reportError";
import { SITE_URL } from "@/utils/site";

// Согласование библейских нумераций: где один и тот же стих стоит в каждом издании.
//
//   /api/v2/concordance?ref=psaltir.9.13                      — по каноническому адресу
//   /api/v2/concordance?ref=pritchi.24.1&from=grc-lxx-pat     — по счёту самого издания
//   /api/v2/concordance                                       — что это и как этим пользоваться
//
// Ручка отвечает на вопрос, который в области стоит у всякого, кто работает больше
// чем с одним изданием, и на который сегодня отвечать нечем: пара «глава:стих» не
// значит ничего, пока не сказано, чьим счётом она названа. У нас соответствия
// разобраны на 192 106 стихах шести изданий — попутно, ради собственной сверки.
//
// Постраничного обхода нет намеренно: всю таблицу берут файлом из выгрузки (/data),
// а по одному стиху — здесь.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    // Раздел тот же, что у чтения Библии: это её же таблица, только без текста.
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const raw = url.searchParams.get("ref");

    try {
        const db = (await clientPromise).db("typikon");

        if (raw === null) {
            const editions = await publicEditions(db);

            return respond({
                name: "Согласование библейских нумераций",
                description:
                    "Где один и тот же стих стоит в каждом издании. Адрес канонический "
                    + "(приведённый к Елизаветинской Библии) — тот же, которым названы зачала.",
                usage: {
                    byCanon: "/api/v2/concordance?ref=psaltir.9.13",
                    byEdition: "/api/v2/concordance?ref=pritchi.24.1&from=grc-lxx-pat",
                },
                // Оговорка обязательна: иначе таблицу прочтут как «стихи одинаковы».
                caveat:
                    "Соответствие места, а не текста: у стиха может не оказаться пары в другом "
                    + "издании, а разорванный надвое стих даёт два места в одном издании.",
                bulk: {
                    what: "Вся таблица — 192 106 строк — отдаётся файлом, по одной строке на стих.",
                    where: `${SITE_URL}/data`,
                },
                editions: editions.map(bibleEdition),
            }, { maxAge: 3600 });
        }

        const ref = parseRef(raw);
        if (!ref) {
            return fail("bad_request", "Адрес стиха задаётся как книга.глава.стих, например psaltir.9.13");
        }

        const from = (url.searchParams.get("from") || "").trim() || undefined;
        const found = await concordanceFor(db, ref, from);

        if (!found) {
            return fail(
                "not_found",
                from
                    ? "Такого стиха нет в этом издании — проверьте слуг книги и счёт"
                    : "Такого стиха нет ни в одном издании собрания",
            );
        }

        return respond(found, { maxAge: 3600 });
    } catch (e) {
        reportError(e, { where: "api/v2/concordance", source: "api" });
        return fail("internal", "Не удалось прочитать таблицу согласования");
    }
}
