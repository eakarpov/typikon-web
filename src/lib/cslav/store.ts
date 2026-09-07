import clientPromise from "@/lib/mongodb";
import type { CslAnswer } from "@/lib/cslav/convert";

// Указатель написаний в базе.
//
// ⚠️ КЛЮЧ ЗДЕСЬ НЕ ТОТ, ЧТО У СЛОВАРЯ УДАРЕНИЙ. В `typikon-csl.accents` ключом
// служит accentKey: он снимает надстрочные знаки, но графику НЕ сводит, и
// «тебѣ» с «тебе» остаются там разными записями. Здесь ключ — civilKey: графика
// сведена и конечный ер снят, потому что спрашивают у указателя гражданским
// написанием. Две коллекции в одной базе с разными ключами — готовая ловушка,
// и путать их нельзя.
//
// Отдельного индекса нет и не нужно: обращение только по _id.

export const SPELLINGS_DB = "typikon-csl";
export const SPELLINGS_COLLECTION = "spellings";

interface SpellingDocument {
    _id: string;
    c?: Array<{ w: string; n: number; d: number }>;
    /** Минея церковнославянским шрифтом: чужая оцифровка, отдельно от собрания. */
    m?: Array<{ w: string; n: number; d: number }>;
    x?: Array<{ w: string; l: string; p: string; s?: string }>;
    b?: Array<{ w: string; n: number }>;
    /** Сокращения; o: 1 — дониконовское, синодальному набору не годится. */
    t?: Array<{ w: string; n: number; o?: 1 }>;
    a: boolean | null;
}

const empty = (word: string): CslAnswer => ({
    word, known: false, agree: null, corpus: [], menaion: [], lexicon: [], bible: [], titlo: [],
});

/**
 * Ответы указателя на список ключей.
 *
 * Один заход в базу на весь текст — тем же приёмом, что разметка ударений:
 * иначе страница на тысячу слов дала бы тысячу запросов. Порядок ответа
 * соответствует порядку запроса.
 */
export const lookupSpellings = async (keys: string[]): Promise<CslAnswer[]> => {
    if (!keys.length) return [];

    const client = await clientPromise;
    const found = await client.db(SPELLINGS_DB).collection<SpellingDocument>(SPELLINGS_COLLECTION)
        .find({ _id: { $in: keys } }).toArray();

    const byKey = new Map(found.map((doc) => [doc._id, doc]));
    return keys.map((key) => {
        const doc = byKey.get(key);
        if (!doc) return empty(key);
        return {
            word: key,
            known: Boolean(doc.c?.length || doc.m?.length || doc.x?.length || doc.b?.length),
            agree: doc.a ?? null,
            corpus: doc.c ?? [],
            menaion: doc.m ?? [],
            lexicon: doc.x ?? [],
            bible: doc.b ?? [],
            titlo: doc.t ?? [],
        };
    });
};

export interface SpellingsSummary {
    keys: number;
    fromCorpus: number;
    /** Ключей, где словарь и собрание сходятся. */
    agreeing: number;
}

/** Числа для подписи под формой: указатель должен говорить о своём размере сам. */
export const summarize = async (): Promise<SpellingsSummary> => {
    const client = await clientPromise;
    const collection = client.db(SPELLINGS_DB).collection<SpellingDocument>(SPELLINGS_COLLECTION);
    const [keys, fromCorpus, agreeing] = await Promise.all([
        collection.countDocuments(),
        collection.countDocuments({ c: { $exists: true } }),
        collection.countDocuments({ a: true }),
    ]);
    return { keys, fromCorpus, agreeing };
};
