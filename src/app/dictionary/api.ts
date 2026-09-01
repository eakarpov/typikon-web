import clientPromise from "@/lib/mongodb";
import { normalizeChurchSlavonic } from "@/utils/churchSlavonic";
import { partOfSpeech } from "@/lib/morphology/tags";

// Поиск по лемме. Ключ — поле lexems.search: это лемма, приведённая к гражданке
// (ѣ→е, ѡ→о, і→и, ꙋ→у, ѳ→ф) и без конечного ъ. Поэтому запрос приводим тем же
// способом — иначе «Бо́гъ», «бг҃ъ» и «бог» окажутся тремя разными словами.
//
// Раньше здесь стояло точное равенство, и найти можно было только тот вид, в каком
// слово лежит в базе. Теперь ищем и по началу слова: «глагол» находит «глаго́лати»,
// «глаго́ланіе», «глаго́ливый» — то есть гнездо, а не одну запись.

export const MIN_QUERY_LENGTH = 3;
export const SEARCH_LIMIT = 60;

export interface Found {
    id: string;
    name: string;
    /** Пометы словаря как есть — «S,m,anim». */
    properties: string;
    pos: string;
    scheme: string;
}

const POS_LABELS: Record<string, string> = {
    noun: "существительное", adjective: "прилагательное", verb: "глагол", other: "",
};

/** Тот же ключ, каким набрано поле search: гражданка без конечного ера. */
export const searchKey = (query: string) =>
    normalizeChurchSlavonic(query).trim().replace(/ъ$/, "");

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const searchData = async (query: string): Promise<[Found[] | null, string | null]> => {
    try {
        const key = searchKey(decodeURI(query));

        if (key.length < MIN_QUERY_LENGTH) {
            return [null, `Увеличьте строку хотя бы до ${MIN_QUERY_LENGTH} букв.`];
        }

        const client = await clientPromise;
        const found = await client.db("typikon-csl").collection("lexems")
            .find({ search: { $regex: `^${escape(key)}` } })
            .collation({ locale: "ru" })
            .limit(SEARCH_LIMIT)
            .toArray();

        // Точное совпадение — вперёд: кто искал «богъ», тому нужен «Бо́гъ», а не
        // «богове́дѣніе», которое короче по алфавиту не станет.
        const items = found
            .map((lexeme) => ({
                id: lexeme._id.toString(),
                name: String(lexeme.name ?? ""),
                properties: String(lexeme.properties ?? ""),
                pos: POS_LABELS[partOfSpeech(String(lexeme.properties ?? ""))] ?? "",
                scheme: String(lexeme.scheme ?? ""),
            }))
            .sort((a, b) => {
                const exact = Number(searchKey(b.name) === key) - Number(searchKey(a.name) === key);
                return exact || a.name.localeCompare(b.name, "ru");
            });

        return [items, null];
    } catch (e) {
        console.error(e);
        return [null, "Словарь сейчас недоступен."];
    }
};
