import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { chapterPlaces } from "@/lib/places/query";
import { bibleBook } from "@/utils/bibleBooks";
import { reportError } from "@/lib/reportError";

// МЕСТА ГЛАВЫ: что названо в её стихах и в каких именно.
//
// Отдельной ручкой, а не полем главы: глава — самый частый и самый тяжёлый ответ
// раздела Библии (стихи нескольких изданий рядом), и доплачивать за места должен
// тот, кто их открыл.
//
// Номер главы КАНОНИЧЕСКИЙ. Своего счёта изданий здесь нет нарочно: упоминания
// привязаны к каноническому месту (`canonRef`), и в чужой нумерации номера стихов
// указывали бы не на те строки.
//
// Места с латинским именем сюда не попадают — так же, как и на странице сайта:
// «Beth-arabah» посреди славянского текста читателю ничего не говорит.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ canonId: string; chapter: string }> },
) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const { canonId, chapter: chapterParam } = await params;

    const canon = bibleBook(canonId);
    if (!canon) return fail("not_found", "Такой книги нет ни в каноне, ни в приложении");

    const chapter = Number(chapterParam);
    if (!Number.isInteger(chapter) || chapter < 1) {
        return fail("bad_request", "Номер главы указан неверно");
    }

    try {
        const found = await chapterPlaces(canonId, chapter);

        return respondCollection(
            found.map((place) => ({
                id: place.id,
                /** `null` — страница места скрыта: имя показываем, перехода нет. */
                slug: place.href ? place.href.replace(/^\/places\//, "") : null,
                name: place.name,
                verses: place.verses,
            })),
            { total: found.length, limit: found.length, offset: 0 },
            { access },
        );
    } catch (e) {
        reportError(e, { where: "app/api/v2/bible/[canonId]/[chapter]/places/route#GET", source: "api" });
        return fail("internal", "Не удалось получить места главы");
    }
}
