import clientPromise from "@/lib/mongodb";

export const searchData = async (query?: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const queryStr = decodeURI(query || "");

        if (!query) {
            const notes = await db
                .collection("notes")
                .find({})
                .limit(10)
                .toArray();
            return [notes, null];
        }

        const notes = await db
            .collection("notes")
            .find({
                $text: {
                    $search: queryStr,
                    $language: "russian"
                },
            }).collation({ locale: "ru"})
            .map(e => ({
                ...e,
                textId: e.textId.toString(),
                _id: e._id.toString(),
            }))
            .toArray();
        return [notes, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};
