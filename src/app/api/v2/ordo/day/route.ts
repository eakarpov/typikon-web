import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { parseOrdoDay } from "@/lib/api/v2/ordoParams";
import { ordoDayDetailed } from "@/lib/ordo";
import { reportError } from "@/lib/reportError";

// Что за день по уставу: памяти, знак, варианты дня, стояния и службы без
// текстов. Тексты — в соседнюю ручку, службами: собранная служба весит много,
// и просить её «за компанию с днём» — значит платить сборкой за нежеланное.
//
// День-объект для одной даты один и тот же в течение суток, поэтому кэш —
// как у календаря: час публичного кэша, сброс тегом ordo при выкладке движка.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "ordo");
    if (access.denied) return access.denied;

    const parsed = parseOrdoDay(new URL(request.url));
    if (!parsed.ok) return fail("bad_request", parsed.error);

    try {
        const asked = await ordoDayDetailed(parsed.value.date, { ustav: parsed.value.ustav ?? undefined });
        if (!asked.day) {
            // 404 от движка — дата вне расчёта или устав ему незнаком; иначе
            // служба устава в беде, и текст её ответа доезжает до клиента.
            if (asked.status === 404) return fail("not_found", asked.error ?? "День не найден");
            return fail("ordo_unavailable", asked.error ?? "Служба устава не ответила");
        }
        return respond(asked.day, {
            access,
            headers: asked.version ? { "X-Ordo-Version": asked.version } : {},
        });
    } catch (e) {
        reportError(e, { where: "app/api/v2/ordo/day/route#GET", source: "api" });
        return fail("internal", "Не удалось собрать день");
    }
}
