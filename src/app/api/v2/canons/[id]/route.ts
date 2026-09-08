import { authorize } from "@/lib/api/v2/access";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { canonDetail } from "@/lib/api/v2/serialize";
import { getCanon } from "@/lib/canons";
import { reportError } from "@/lib/reportError";

// КАНОН ЦЕЛИКОМ, песнями подряд: ирмос, затем тропари.
//
// НУМЕРАЦИЯ ПЕСНЕЙ НЕ СПЛОШНАЯ, и это не изъян разбора. Второй песни нет ни у
// кого, кроме Великого канона, а трипеснцы Триоди несут три и меньше. Номер
// отдаётся тот, что стоит у песни в книге; перенумеровав их подряд, клиент
// «починит» пропуск, которого нет, и разойдётся с книгой.
//
// Ссылки на Ирмологий разрешены на сервере, как это делает сборка устава:
// книги печатают ирмос зачином, а полный текст лежит там. Подставленный текст
// помечен `borrowed` — показать его неподписанным значило бы выдать отсылку за
// песнопение.
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
        const canon = getCanon(id);
        if (!canon) return fail("not_found", "Такого канона в корпусе нет");

        return respond(canonDetail(canon), { access, maxAge: revalidate });
    } catch (e) {
        reportError(e, { where: "app/api/v2/canons/[id]/route#GET", source: "api" });
        return fail("corpus_unavailable", "Корпус певческих текстов сейчас недоступен");
    }
}
