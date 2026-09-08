import { authorize } from "@/lib/api/v2/access";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { readPage } from "@/lib/api/v2/params";
import { canonSummary } from "@/lib/api/v2/serialize";
import { canonFacets, listCanons } from "@/lib/canons";
import { reportError } from "@/lib/reportError";

// КАНОНЫ КНИГ: Октоих, Минеи, Триоди, Минея общая — каждый со всеми песнями.
//
// ПУСТОЙ ЗАПРОС ЗДЕСЬ НЕ ОШИБКА, А НАЧАЛО ПРОСМОТРА. Тем раздел и отличается от
// поиска по песнопениям: там без слова показывать нечего — весь корпус в 94
// тысячи строк, — а здесь перечень канонов сам по себе и есть содержимое
// раздела. Поиск его сужает, а не открывает.
//
// ЧЕМ СУЗИТЬ — ПРИЕЗЖАЕТ ВМЕСТЕ С ВЫДАЧЕЙ, а не отдельной ручкой. Значения
// берутся из самого корпуса, и список, приехавший с ответом, разойтись с ним не
// может; зашитый у клиента — разошёлся бы молча, как только в корпусе заведут
// новую роль или книгу.
//
// Раздел доступа `texts`: полнотекстового запроса здесь нет — отбор идёт по
// меткам в памяти.
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
        const facets = canonFacets();
        // `null` — корпуса на сервере нет вовсе. Пустая выдача сказала бы
        // «канонов не нашлось», а это неправда: мы не смотрели.
        if (!facets) {
            return fail("corpus_unavailable", "Корпус певческих текстов на этом сервере недоступен");
        }

        const tone = Number(url.searchParams.get("tone"));
        const found = listCanons({
            q: url.searchParams.get("q"),
            book: url.searchParams.get("book"),
            tone: Number.isFinite(tone) && tone ? tone : null,
            service: url.searchParams.get("service"),
            role: url.searchParams.get("role"),
        }, limit, offset);

        return respond({
            items: (found?.items ?? []).map(canonSummary),
            total: found?.total ?? 0,
            limit,
            offset,
            facets,
        }, { access, maxAge: revalidate });
    } catch (e) {
        // Корпус — артефакт сборки соседнего проекта: на время пересборки файл
        // заперт, и SQLite отвечает отказом даже на чтение. Это не поломка
        // раздела, а его временная недоступность.
        reportError(e, { where: "app/api/v2/canons/route#GET", source: "api" });
        return fail("corpus_unavailable", "Корпус певческих текстов сейчас недоступен");
    }
}
