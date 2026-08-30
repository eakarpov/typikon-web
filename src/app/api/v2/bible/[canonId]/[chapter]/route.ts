import clientPromise from "@/lib/mongodb";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { bibleEdition, bibleVerse } from "@/lib/api/v2/serialize";
import { canonBook } from "@/utils/bibleCanon";
import { editionsByCodes, parallelChapter, publicEditions } from "@/lib/bible/query";

// Глава Библии, при желании — сразу в нескольких изданиях.
//
//   /api/v2/bible/daniila/3                             — все публичные издания
//   /api/v2/bible/daniila/3?editions=cs-eliz            — одно
//   /api/v2/bible/daniila/3?editions=cs-eliz,ro-1688    — рядом, стих против стиха
//
// Стихи сводятся по КАНОНИЧЕСКОМУ месту, а не по номеру строки: в ответе на месте
// стиха, которого у издания нет, стоит null, а не сдвинутый соседний. У румынской
// Псалтири в девятом псалме на стих меньше, чем у славянской, и склеить их «подряд»
// значило бы выдать читателю чужую строку за нужную.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(
    request: Request,
    { params }: { params: { canonId: string; chapter: string } },
) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const canon = canonBook(params.canonId);
    if (!canon) return fail("not_found", "Такой книги нет в каноне");

    const chapter = Number(params.chapter);
    if (!Number.isInteger(chapter) || chapter < 1) {
        return fail("bad_request", "Номер главы указан неверно");
    }

    try {
        const db = (await clientPromise).db("typikon");

        const requested = (new URL(request.url).searchParams.get("editions") || "")
            .split(",").map((code) => code.trim()).filter(Boolean);
        const editions = requested.length
            ? await editionsByCodes(db, requested)
            : await publicEditions(db);

        if (!editions.length) {
            return fail("not_found", "Таких изданий нет");
        }

        const rows = await parallelChapter(db, editions, canon.id, chapter);
        if (!rows.length) {
            return fail("not_found", "В этих изданиях такой главы нет");
        }

        return respond({
            book: { id: canon.id, name: canon.name, abbr: canon.abbr, section: canon.section },
            chapter,
            editions: editions.map(bibleEdition),
            // Порядок ячеек в строке совпадает с порядком изданий выше.
            verses: rows.map((row) => ({
                canonRef: row.canonRef,
                verse: row.canonVerse,
                editions: row.cells.map((cell) => (cell ? bibleVerse(cell) : null)),
            })),
        }, { access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить главу");
    }
}
