// Чтение корпуса для работы с ударениями: тексты и стихи в одном виде.
//
// Два места, где легко ошибиться, и оба закрыты здесь:
//   * содержимое лежит в ДВУХ коллекциях — у Библии текст не в texts.content,
//     а построчно в bible_verses; половина ударной разметки собрания живёт именно там;
//   * из 73 241 стиха 36 280 принадлежат «Сфънта Скриптура» — Библии на валашской
//     кириллице 1688 года. Это другой язык и другой набор надстрочных знаков, и в
//     церковнославянском словаре ему делать нечего.
//
// Издания отбираются по языку начертания, а не по идентификатору книги, как было
// раньше: изданий станет больше, и список исключений пришлось бы дописывать руками
// при каждом новом — а забытая строка тихо втащила бы чужие знаки в словарь.
import { Db, ObjectId } from "mongodb";
import { BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

/** Начертание церковнославянских изданий — код из @/utils/bookLanguages. */
const CHURCH_SLAVONIC = "cu";

export interface CorpusDoc {
    _id: ObjectId;
    content: string;
    // Для отчётов: алиас текста или «daniila 3:16».
    label: string;
    /** Коллекция, в которую писать правку: правки идут по _id. */
    collection: "texts" | typeof BIBLE_VERSES;
}

export interface Corpus {
    docs: CorpusDoc[];
    texts: number;
    verses: number;
}

export const readChurchSlavonicCorpus = async (db: Db): Promise<Corpus> => {
    const slavonicEditions = await db.collection(BIBLE_EDITIONS)
        .find({ language: CHURCH_SLAVONIC }, { projection: { _id: 1 } })
        .toArray();
    const editionIds = slavonicEditions.map((edition) => edition._id);

    const texts: CorpusDoc[] = (await db.collection("texts")
        .find({ content: { $type: "string" } },
              { projection: { content: 1, alias: 1, name: 1 } })
        .toArray())
        .map((text) => ({
            _id: text._id,
            content: text.content as string,
            label: (text.alias as string) || (text.name as string) || String(text._id),
            collection: "texts" as const,
        }));

    const verses: CorpusDoc[] = (await db.collection(BIBLE_VERSES)
        .find({ editionId: { $in: editionIds } },
              { projection: { content: 1, canonId: 1, chapter: 1, verse: 1 } })
        .toArray())
        .map((verse) => ({
            _id: verse._id,
            content: verse.content as string,
            label: `${verse.canonId} ${verse.chapter}:${verse.verse}`,
            collection: BIBLE_VERSES,
        }));

    return { docs: [...texts, ...verses], texts: texts.length, verses: verses.length };
};
