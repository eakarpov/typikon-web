// Чтение корпуса для работы с ударениями: тексты и стихи в одном виде.
//
// Два места, где легко ошибиться, и оба закрыты здесь:
//   * содержимое лежит в ДВУХ коллекциях — у библейских книг текст не в
//     texts.content, а построчно в verses; половина ударной разметки собрания
//     живёт именно там;
//   * из 73 241 стиха 36 280 принадлежат «Сфънта Скриптура» — Библии на
//     валашской кириллице 1688 года. Это другой язык и другой набор надстрочных
//     знаков, и в церковнославянском словаре ему делать нечего.
import { Db, ObjectId } from "mongodb";

// См. src/scripts/import-bible-cyrillic.ts — там этот идентификатор и заводится.
export const ROMANIAN_BOOK_ID = new ObjectId("6989959c169656dfeafaa36a");

export interface CorpusDoc {
    _id: ObjectId;
    content: string;
    // Для отчётов: алиас текста или «стих 3:16».
    label: string;
    collection: "texts" | "verses";
}

export interface Corpus {
    docs: CorpusDoc[];
    texts: number;
    verses: number;
}

export const readChurchSlavonicCorpus = async (db: Db): Promise<Corpus> => {
    const romanianTextIds = (await db.collection("texts")
        .find({ bookId: ROMANIAN_BOOK_ID }, { projection: { _id: 1 } })
        .toArray()).map((text) => text._id);

    const texts: CorpusDoc[] = (await db.collection("texts")
        .find({ content: { $type: "string" }, bookId: { $ne: ROMANIAN_BOOK_ID } },
              { projection: { content: 1, alias: 1, name: 1 } })
        .toArray())
        .map((text) => ({
            _id: text._id,
            content: text.content as string,
            label: (text.alias as string) || (text.name as string) || String(text._id),
            collection: "texts" as const,
        }));

    const verses: CorpusDoc[] = (await db.collection("verses")
        .find({ textId: { $nin: romanianTextIds } },
              { projection: { content: 1, chapter: 1, verse: 1 } })
        .toArray())
        .map((verse) => ({
            _id: verse._id,
            content: verse.content as string,
            label: `стих ${verse.chapter}:${verse.verse}`,
            collection: "verses" as const,
        }));

    return { docs: [...texts, ...verses], texts: texts.length, verses: verses.length };
};
