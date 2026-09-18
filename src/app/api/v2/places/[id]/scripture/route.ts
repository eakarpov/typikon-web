import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { readPage } from "@/lib/api/v2/params";
import { getItem } from "@/app/places/[id]/api";
import { placeVerse } from "@/lib/api/v2/serialize";
import { placeScripture } from "@/lib/places/query";
import { BIBLE_CANON } from "@/utils/bibleCanon";
import { reportError } from "@/lib/reportError";

// СТИХИ ПИСАНИЯ, ГДЕ МЕСТО НАЗВАНО, — по книге и постранично.
//
// Отдельно от `/places/{id}/mentions` по одной причине, и она измерена: у
// Иерусалима 773 стиха, каждый со славянским отрывком, — в общем ответе это
// триста с лишним килобайт на каждое открытие места. Здесь же читатель платит
// за ту книгу, которую раскрыл.
//
// Только принятые упоминания: ожидающие сверки считаются отдельно и приходят
// числом в `mentions`.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const { id } = await params;
    const url = new URL(request.url);
    const { limit, offset } = readPage(url);
    const book = url.searchParams.get("book");

    // Незнакомая книга — отказ, а не пустой список: «стихов нет» и «такой книги
    // в каноне нет» читаются одинаково, а значат разное.
    if (book && !BIBLE_CANON.some((b) => b.id === book)) {
        return fail("bad_request", `Книги «${book}» нет в каноне`);
    }

    try {
        const [place, error] = await getItem(id);
        if (error) return fail("internal", "Не удалось получить стихи места");
        if (!place) return fail("not_found", "Такого места нет");

        const { books } = await placeScripture(place.id);
        const abbrOf = (canonId: string) =>
            BIBLE_CANON.find((b) => b.id === canonId)?.abbr ?? null;

        // Порядок канонический — тот же, в каком книги перечислены в ответе
        // `mentions`, чтобы раскрытая книга и её стихи шли друг за другом.
        const all = books
            .filter((b) => !book || b.canonId === book)
            .flatMap((b) => b.verses.map((v) => ({
                ...v, canonId: b.canonId, abbr: abbrOf(b.canonId),
            })));

        return respondCollection(
            all.slice(offset, offset + limit).map(placeVerse),
            { total: all.length, limit, offset },
            { access },
        );
    } catch (e) {
        reportError(e, { where: "app/api/v2/places/[id]/scripture/route#GET", source: "api" });
        return fail("internal", "Не удалось получить стихи места");
    }
}
