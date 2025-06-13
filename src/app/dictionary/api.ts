import clientPromise from "@/lib/mongodb";

function checkUTF8(text: string) {
    var utf8Text = text;
    try {
        // Try to convert to utf-8
        utf8Text = decodeURIComponent(escape(text));
        // If the conversion succeeds, text is not utf-8
    }catch(e) {
        // console.log(e.message); // URI malformed
        // This exception means text is utf-8
    }
    return utf8Text; // returned text is always utf-8
}

export const searchData = async (query: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-csl");
        const queryStr = decodeURI(query);

        if (queryStr.length < 3) {
            return [null, "Увеличьте строку хотя бы до 3 символов."]
        }

        console.log();

        const texts = await db
            .collection("lexems")
            .find({
                search: {$eq: queryStr }
                // $text: {
                //     $search: `${queryStr}`,
                //     $language: "russian",
                //     $diacriticSensitive: false,
                //     $caseSensitive: false,
                // },
            }).collation({ locale: "ru"})
            .map(e => ({
                ...e,
                _id: e._id.toString(),
            }))
            .toArray();
        console.log(texts, queryStr);
        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};
