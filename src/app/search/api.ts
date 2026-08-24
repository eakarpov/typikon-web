import clientPromise from "@/lib/mongodb";
import { normalizeQuery, snippetFor } from "@/lib/search";

// Поиск идёт по нормализованным полям searchName/searchContent (см. @/lib/search):
// по самому content искать нельзя — ударения стоят внутри слов. Поля заполняются
// при сохранении в админке и скриптом src/scripts/build-search-index.ts.
export const SEARCH_LIMIT = 100;
export const MIN_QUERY_LENGTH = 3;

export const searchData = async (query: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const queryStr = normalizeQuery(decodeURI(query));

        if (queryStr.length < MIN_QUERY_LENGTH) {
            return [null, `Увеличьте строку хотя бы до ${MIN_QUERY_LENGTH} символов.`]
        }

        const found = await db
            .collection("texts")
            .find({
                $text: {
                    $search: queryStr,
                    $language: "russian",
                },
            }, {
                // Нормализованные копии наружу не отдаём — это те же тексты ещё раз.
                // content забираем, но только чтобы вырезать фрагмент, и удаляем ниже.
                projection: {
                    searchName: 0,
                    searchContent: 0,
                    score: { $meta: "textScore" },
                },
            })
            .sort({ score: { $meta: "textScore" } })
            .limit(SEARCH_LIMIT)
            .toArray();

        const texts = found.map(({ content, ...rest }) => ({
            ...rest,
            bookId: rest.bookId?.toString(),
            id: rest._id.toString(),
            // Фрагмент вырезается из исходного текста, с ударениями и ЦС-графикой,
            // чтобы было видно, за что текст найден.
            snippet: snippetFor(content, queryStr),
        }));

        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};
