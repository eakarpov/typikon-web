import { authorize } from "@/lib/api/v2/access";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { readPage } from "@/lib/api/v2/params";
import { prayerSummary } from "@/lib/api/v2/serialize";
import { listPrayers, prayerFacets } from "@/lib/prayers";
import { reportError } from "@/lib/reportError";

// МОЛИТВЫ КНИГ И МОЛИТВЫ ПРИ АКАФИСТАХ.
//
// Молитву называет не подпись, а тот, при ком она стоит: подписаны почти все
// просто «Моли́тва». Оттого в перечне рядом с подписью едет и владелец, и зачин —
// последний и есть то единственное, чем две молитвы одного акафиста
// различаются.
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
        const facets = prayerFacets();
        if (!facets) {
            return fail("corpus_unavailable", "Корпус певческих текстов на этом сервере недоступен");
        }

        const found = listPrayers({
            q: url.searchParams.get("q"),
            kind: url.searchParams.get("kind"),
        }, limit, offset);

        return respond({
            items: (found?.items ?? []).map(prayerSummary),
            total: found?.total ?? 0,
            limit,
            offset,
            facets,
        }, { access, maxAge: revalidate });
    } catch (e) {
        reportError(e, { where: "app/api/v2/prayers/route#GET", source: "api" });
        return fail("corpus_unavailable", "Корпус певческих текстов сейчас недоступен");
    }
}
