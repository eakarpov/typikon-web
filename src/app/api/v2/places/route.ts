import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { readPage } from "@/lib/api/v2/params";
import { placeSummary } from "@/lib/api/v2/serialize";
import { KIND_LABELS } from "@/lib/places/labels";
import { placesIndex } from "@/lib/places/query";
import { matches } from "@/lib/places/search";
import type { PlaceKind } from "@/lib/places/schema";
import { reportError } from "@/lib/reportError";

// УКАЗАТЕЛЬ МЕСТ — постранично, по алфавиту. Только открытые: место, заведённое
// импортом и не получившее русского имени, не показывается и на сайте.
//
// СОБИРАЕТСЯ ИЗ ТОГО ЖЕ `placesIndex`, ЧТО И СТРАНИЦА САЙТА. Прежде ручка ходила
// в Mongo своим запросом, и отбор у неё был свой: искать по имени она не умела
// вовсе. Теперь правило приведения имён одно на обоих (`@/lib/places/search`), и
// «Царьград» находит Константинополь и там, и там.
//
// Мест открытых чуть больше тысячи, и отбор идёт в памяти поверх общего кэша —
// как в разделе канонов. Индекса под поиск нет нарочно: `$text` не умеет ни «ё»,
// ни склейку дефисов, то есть искал бы не то, что ищет сайт.
//
// ЧЕМ СУЗИТЬ — ПРИЕЗЖАЕТ ВМЕСТЕ С ВЫДАЧЕЙ: роды мест считаются по самому
// указателю, и список, приехавший с ответом, разойтись с ним не может. Зашитый
// у клиента разошёлся бы молча, как только в корпусе заведут новый род.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const { limit, offset } = readPage(url);
    const q = url.searchParams.get("q") ?? "";
    const kindParam = url.searchParams.get("kind");
    const kind = kindParam && kindParam in KIND_LABELS ? kindParam as PlaceKind : null;
    const scriptureOnly = url.searchParams.get("scripture") === "1";

    try {
        const all = await placesIndex();

        // Роды считаются по выдаче ДО отбора по роду: иначе, выбрав «реки»,
        // читатель увидел бы в гранях одни реки и не смог бы перейти к горам —
        // список схлопнулся бы до выбранного.
        const found = all.filter((p) =>
            matches(p.haystack, q) && (!scriptureOnly || p.scripture > 0));
        const kinds = Object.keys(KIND_LABELS)
            .map((code) => ({ code, total: found.filter((p) => p.kind === code).length }))
            .filter((facet) => facet.total > 0);

        const items = found.filter((p) => !kind || p.kind === kind);

        return respond({
            // `total` — сколько НАЙДЕНО по нынешнему отбору, а не сколько мест
            // всего; так же считают прочие перечни v2.
            items: items.slice(offset, offset + limit).map(placeSummary),
            total: items.length,
            limit,
            offset,
            facets: { kinds },
        }, { access, maxAge: revalidate });
    } catch (e) {
        reportError(e, { where: "app/api/v2/places/route#GET", source: "api" });
        return fail("internal", "Не удалось получить места");
    }
}
