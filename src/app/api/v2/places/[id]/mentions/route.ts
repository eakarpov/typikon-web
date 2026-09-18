import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { getItem } from "@/app/places/[id]/api";
import {
    PLACE_SAINTS_CAVEAT, PLACES_ATTRIBUTION,
    placeChantRef, placeRelationRef, placeSaintRef, placeScriptureBook, placeTextRef,
} from "@/lib/api/v2/serialize";
import { placeChants } from "@/lib/places/chants";
import { placeArticles, placeRelations, placeScripture, placeTexts, saintsOfPlace } from "@/lib/places/query";
import { rulesDb } from "@/lib/rulesDb";
import { BIBLE_CANON } from "@/utils/bibleCanon";
import { reportError } from "@/lib/reportError";

// ЧТО КОРПУС ЗНАЕТ ОБ ЭТОМ МЕСТЕ: статьи энциклопедии, отождествления, книги
// Писания, чтения, песнопения, святые.
//
// **Отдельной ручкой, а не полем карточки.** Карточка места (`/places/{id}`) —
// путь по ссылке из текста: открыть, прочитать описание, вернуться. Шесть сводов
// и обращение к певческому корпусу утяжелили бы именно этот, частый случай ради
// редкого.
//
// **СТИХОВ ЗДЕСЬ НЕТ, ТОЛЬКО ИХ ЧИСЛО ПО КНИГАМ.** Замерено: у Иерусалима 773
// стиха, и каждый со славянским отрывком — в одном ответе это триста с лишним
// килобайт, больше всего прочего вместе взятого. Стихи спрашиваются по книге,
// ручкой `/places/{id}/scripture`, ровно когда читатель раскроет книгу, — так же,
// как они свёрнуты на странице сайта.
//
// Час в кэше, а не сутки, как у ударений: упоминания меняются на каждой сверке.
// Метка `CacheTag.PLACES` у всех сводов уже стоит, поэтому правка в админке
// сбрасывает и этот ответ.
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

    try {
        // Через getItem, а не getPlaceByAddress: первый отбрасывает скрытые
        // места. Иначе мы отдавали бы упоминания места, чья карточка отвечает
        // «такого места нет».
        const [place, error] = await getItem(id);
        if (error) return fail("internal", "Не удалось получить упоминания места");
        if (!place) return fail("not_found", "Такого места нет");

        const articleAliases: string[] = (place.externals ?? [])
            .filter((e: any) => e.source === "nikifor")
            .map((e: any) => e.id);

        const [articles, relations, scripture, texts, chants, saints] = await Promise.all([
            placeArticles(articleAliases),
            placeRelations(place.id),
            placeScripture(place.id),
            placeTexts(place.id, place.alias, articleAliases),
            placeChants(place.id),
            saintsOfPlace(place.id),
        ]);

        const abbrOf = (canonId: string) =>
            BIBLE_CANON.find((b) => b.id === canonId)?.abbr ?? null;

        return respond({
            id: place.id,
            slug: place.slug ?? null,
            articles: articles.map(placeTextRef),
            relations: relations.map(placeRelationRef),
            scripture: {
                total: scripture.books.reduce((n, b) => n + b.verses.length, 0),
                /** Сколько стихов ещё ждут сверки: показывать их как факт нельзя. */
                pending: scripture.pending,
                books: scripture.books.map((b) => placeScriptureBook(b, abbrOf(b.canonId))),
            },
            texts: texts.map(placeTextRef),
            /** Двести — предел самой выборки: у Александрии чтений за шестьдесят. */
            textsTruncated: texts.length >= 200,
            chants: {
                total: chants.total,
                shown: chants.items.length,
                // Подписи песнопений приходят не из Mongo, а из певческого
                // корпуса: когда его файла на сервере нет, каждая строка
                // подписалась бы просто «песнопение» — сорок одинаковых строк
                // выглядят поломкой. Пусть клиент скажет об этом словами.
                labelled: rulesDb() !== null,
                items: chants.items.map(placeChantRef),
            },
            saints: saints.map(placeSaintRef),
            saintsCaveat: PLACE_SAINTS_CAVEAT,
            attribution: PLACES_ATTRIBUTION,
        }, { access, maxAge: revalidate });
    } catch (e) {
        reportError(e, { where: "app/api/v2/places/[id]/mentions/route#GET", source: "api" });
        return fail("internal", "Не удалось получить упоминания места");
    }
}
