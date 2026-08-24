import clientPromise from "@/lib/mongodb";

// Поиск идёт по названию текста (текстовый индекс), поэтому тело `content`
// в выдаче не нужно — оно только раздувало ответ на несколько мегабайт.
export const SEARCH_LIMIT = 100;

export const searchData = async (query: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const queryStr = decodeURI(query);

        if (queryStr.length < 3) {
            return [null, "Увеличьте строку хотя бы до 3 символов."]
        }

        const texts = await db
            .collection("texts")
            .find({
                $text: {
                    $search: queryStr,
                    $language: "russian"
                },
            }, {
                projection: {
                    content: 0,
                    score: { $meta: "textScore" },
                },
            })
            .sort({ score: { $meta: "textScore" } })
            .limit(SEARCH_LIMIT)
            .collation({ locale: "ru"})
            .map(e => ({
                ...e,
                bookId: e.bookId?.toString(),
                id: e._id.toString(),
            }))
            .toArray();
        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};
