import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { readPage } from "@/lib/api/v2/params";
import { MIN_QUERY_LENGTH, searchData } from "@/app/dictionary/api";
import { lexemeSummary } from "@/lib/api/v2/serialize";
import { reportError } from "@/lib/reportError";

// Поиск по словарю церковнославянского.
//
// Раздел доступа — «texts»: словарь про слова собрания, а не про календарь, и
// заводить ему своё значение в SCOPES незачем.
//
// Первая версия этой ручки живёт в /api/v1/dictionary и отвечает голым массивом,
// а на всякую ошибку — пустым телом с кодом 400. Здесь конверт и объяснение,
// как у прочих ручек v2: клиенту не должно приходиться гадать, что случилось.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const { limit, offset } = readPage(url);
    const query = (url.searchParams.get("q") ?? "").trim();

    if (query.length < MIN_QUERY_LENGTH) {
        return fail("bad_request", `Запрос должен быть не короче ${MIN_QUERY_LENGTH} символов`);
    }

    try {
        const [found, error] = await searchData(query);
        if (error || !found) return fail("internal", "Поиск по словарю не удался");

        // Отбор идёт по началу слова и уже ограничен на стороне выборки;
        // постраничность здесь — обрезка готового, а не второй запрос.
        return respondCollection(
            found.slice(offset, offset + limit).map(lexemeSummary),
            { total: found.length, limit, offset },
            { access, maxAge: revalidate },
        );
    } catch (e) {
        reportError(e, { where: "app/api/v2/dictionary/route#GET", source: "api" });
        return fail("internal", "Поиск по словарю не удался");
    }
}
