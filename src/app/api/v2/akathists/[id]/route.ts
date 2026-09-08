import { authorize } from "@/lib/api/v2/access";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { akathistDetail } from "@/lib/api/v2/serialize";
import { getAkathist } from "@/lib/akathists";
import { prayersOfAkathist } from "@/lib/prayers";
import { reportError } from "@/lib/reportError";

// АКАФИСТ ЦЕЛИКОМ.
//
// Строфы отдаются в порядке `index` — это порядок чтения, он же порядок показа.
// Сортировать их по паре «род и номер» было бы неверно: проимий и первый икос
// акростиха разошлись бы по разным концам.
//
// Подписывает строфу пара «род + номер» — «икос 6», «кондак 12», — а не сквозной
// счёт: именно парой акафист и цитируют. У проимиев счёт свой, и различает их
// `kind`, а не номер: акростишный «кондак 2» и второй проимий несут одно число.
//
// Молитвы при акафисте едут тем же ответом. Молитва — не строфа: у неё нет ни
// номера, ни места в акростихе, и живёт она своей сущностью. Но печатается она
// здесь же, и читателю нужна здесь же.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const { id: raw } = await ctx.params;

    let id: string;
    try {
        id = decodeURIComponent(raw);
    } catch {
        return fail("bad_request", "Адрес закодирован неверно");
    }

    try {
        const akathist = getAkathist(id);
        if (!akathist) return fail("not_found", "Такого акафиста в корпусе нет");

        return respond(
            akathistDetail(akathist, prayersOfAkathist(id)),
            { access, maxAge: revalidate },
        );
    } catch (e) {
        reportError(e, { where: "app/api/v2/akathists/[id]/route#GET", source: "api" });
        return fail("corpus_unavailable", "Корпус певческих текстов сейчас недоступен");
    }
}
