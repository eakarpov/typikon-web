import clientPromise from "@/lib/mongodb";

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
            }).collation({ locale: "ru"})
            .map(e => ({
                ...e,
                bookId: e.bookId.toString(),
                _id: e._id.toString(),
            }))
            .toArray();
        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};
