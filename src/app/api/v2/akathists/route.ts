import { authorize } from "@/lib/api/v2/access";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { readPage } from "@/lib/api/v2/params";
import { akathistSummary } from "@/lib/api/v2/serialize";
import { akathistFacets, listAkathists } from "@/lib/akathists";
import { reportError } from "@/lib/reportError";

// АКАФИСТЫ КОРПУСА — каждый целиком, все кондаки и икосы подряд.
//
// СКАЗАТЬ ЭТО НАДО ПРЯМО, И ГОВОРИТ ЭТО ПОЛЕ `status`: уставом положен ОДИН
// акафист, Великий; остальные собраны ради корпуса и поиска и в сборку служб не
// идут. Раздел похож на устав и им не является, и клиент, показавший тысячу
// акафистов без этой пометы, пообещает читателю обратное.
//
// Пустой запрос — начало просмотра, как и у канонов. Отборы приезжают с
// выдачей.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const { limit, offset } = readPage(url);

    try {
        const facets = akathistFacets();
        if (!facets) {
            return fail("corpus_unavailable", "Корпус певческих текстов на этом сервере недоступен");
        }

        const found = listAkathists({
            q: url.searchParams.get("q"),
            subjectKind: url.searchParams.get("subject"),
            status: url.searchParams.get("status"),
        }, limit, offset);

        return respond({
            items: (found?.items ?? []).map(akathistSummary),
            total: found?.total ?? 0,
            limit,
            offset,
            facets,
        }, { access, maxAge: revalidate });
    } catch (e) {
        reportError(e, { where: "app/api/v2/akathists/route#GET", source: "api" });
        return fail("corpus_unavailable", "Корпус певческих текстов сейчас недоступен");
    }
}
