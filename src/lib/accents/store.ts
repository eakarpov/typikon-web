import clientPromise from "@/lib/mongodb";
import { accentKey, KAMORA, OXIA, VARIA } from "@/lib/accents/core";

// Доступ к словарю ударений. Данные лежат в typikon-csl — там же, где словарь
// церковнославянского языка: у обеих баз одно пространство ключей (наш accentKey
// совпадает с lexems.search), обе пересчитываются редко и обе едут своим релизом
// (csl-db-release.sh делает mongodump всей базы, так что новая коллекция попадает
// на сервер без единой новой строки в выкладке).
//
// Соседняя коллекция, а не поле внутри lexems: словарь описывает лексему с её
// парадигмой, а корпус — живое употребление словоформы. Это разные сущности с
// разной наполняемостью (пересечение — треть с каждой стороны), и сливать их в
// одну запись значило бы потерять, откуда что взялось.

export const ACCENTS_DB = "typikon-csl";
export const ACCENTS_COLLECTION = "accents";

/** Как называется знак — для ответов наружу; внутри хранится сам символ. */
export const MARK_NAMES: Record<string, string> = {
    [OXIA]: "оксия",
    [VARIA]: "вария",
    [KAMORA]: "камора",
};

// Имена полей в хранении короткие: записей 260 тысяч, и в каждой по нескольку
// вариантов, так что имена полей весят больше самих данных. При длинных именах
// коллекция занимала 53,6 МБ и раздувала typikon-csl с 8 МБ до 70 — а базу возят
// на сервер целиком, архивом по scp. Наружу всё это разворачивается в читаемый вид
// ниже, так что короткие имена не выходят за пределы модуля.
//
//   v — номер ударной гласной, m — знак, s — написание,
//   n — сколько раз (в корпусе и песнопениях — вхождений, в словаре — форм),
//   l — лексема, p — грамматические пометы.
//
//   c — корпус книг, h — корпус песнопений, x — словарь, a — согласие источников.

interface StoredCorpusVariant { v: number; m: string; s: string; n: number }
interface StoredLexiconVariant { v: number; m: string; s: string; l: string; p: string; n: number }

export interface AccentRecord {
    _id: string;
    c?: StoredCorpusVariant[];
    h?: StoredCorpusVariant[];
    x?: StoredLexiconVariant[];
    /** Совпадает ли ударная гласная у всех источников, которые знают слово;
     *  null — знает только один, спорить не с кем. */
    a: boolean | null;
}

/** Засвидетельствовано в корпусе: где стоит знак и сколько раз так написано. */
export interface CorpusVariant {
    /** Номер ударной гласной с нуля — не позиция символа: та зависит от того,
     *  разложены ли ї и й, а номер гласной не зависит. */
    vowel: number;
    mark: string;
    spelling: string;
    count: number;
}

/** Порождено словарём: та же позиция плюс грамматика. */
export interface LexiconVariant {
    vowel: number;
    mark: string;
    spelling: string;
    lexeme: string;
    properties: string;
    /** Сколько форм словаря дали это положение ударения. */
    forms: number;
}

export const toStoredCorpus = (variant: CorpusVariant): StoredCorpusVariant =>
    ({ v: variant.vowel, m: variant.mark, s: variant.spelling, n: variant.count });

export const toStoredLexicon = (variant: LexiconVariant): StoredLexiconVariant =>
    ({ v: variant.vowel, m: variant.mark, s: variant.spelling, l: variant.lexeme, p: variant.properties, n: variant.forms });

export interface AccentAnswer {
    word: string;
    known: boolean;
    agree: boolean | null;
    corpus: (CorpusVariant & { markName: string; share: number })[];
    chants: (CorpusVariant & { markName: string; share: number })[];
    lexicon: (LexiconVariant & { markName: string })[];
}

const collection = async () => {
    const client = await clientPromise;
    return client.db(ACCENTS_DB).collection<AccentRecord>(ACCENTS_COLLECTION);
};

const missing = (word: string): AccentAnswer =>
    ({ word, known: false, agree: null, corpus: [], chants: [], lexicon: [] });

// Доля считается внутри источника, а не по всем сразу: у книг и у гимнографии
// распределение разное («спасе́» — аорист в чтениях, «спа́се» — звательный в
// песнопениях), и общая доля смешала бы два разных ответа в один невнятный.
const withShares = (variants: StoredCorpusVariant[]) => {
    const total = variants.reduce((sum, variant) => sum + variant.n, 0);
    return variants.map((variant) => ({
        vowel: variant.v,
        mark: variant.m,
        markName: MARK_NAMES[variant.m] ?? variant.m,
        spelling: variant.s,
        count: variant.n,
        // Доля нужна, чтобы потребитель ставил свой порог, а не верил нашему.
        share: total ? Number((variant.n / total).toFixed(4)) : 0,
    }));
};

const dress = (word: string, record: AccentRecord): AccentAnswer => {
    const lexicon = record.x ?? [];

    return {
        word,
        known: true,
        agree: record.a,
        corpus: withShares(record.c ?? []),
        chants: withShares(record.h ?? []),
        lexicon: lexicon.map((variant) => ({
            vowel: variant.v,
            mark: variant.m,
            markName: MARK_NAMES[variant.m] ?? variant.m,
            spelling: variant.s,
            lexeme: variant.l,
            properties: variant.p,
            forms: variant.n,
        })),
    };
};

/**
 * Ищет слова пачкой. Ключ снимается тем же accentKey, что строил словарь, поэтому
 * слово можно слать как есть — с ударениями, звательцем, в любой графике.
 * Ответ идёт в порядке запроса: иначе клиенту нечем сшить его обратно.
 */
export const lookupWords = async (words: string[]): Promise<AccentAnswer[]> => {
    const keys = words.map(accentKey);
    const unique = [...new Set(keys.filter(Boolean))];
    if (!unique.length) return words.map(missing);

    const found = await (await collection()).find({ _id: { $in: unique } }).toArray();
    const byKey = new Map(found.map((record) => [record._id, record]));

    return words.map((word, index) => {
        const record = byKey.get(keys[index]);
        return record ? dress(word, record) : missing(word);
    });
};

export const lookupWord = async (word: string): Promise<AccentAnswer> =>
    (await lookupWords([word]))[0];

export interface AccentSummary {
    words: number;
    fromCorpus: number;
    fromChants: number;
    fromLexicon: number;
    /** Знают хотя бы двое — только у них есть о чём спорить. */
    compared: number;
    agree: number;
    disagree: number;
}

/** Сводка по всему словарю — для корня раздела и для счётчика в /api/v2. */
export const summarize = async (): Promise<AccentSummary> => {
    const accents = await collection();

    const [words, fromCorpus, fromChants, fromLexicon, compared, agree, disagree] = await Promise.all([
        accents.countDocuments({}),
        accents.countDocuments({ "c.0": { $exists: true } }),
        accents.countDocuments({ "h.0": { $exists: true } }),
        accents.countDocuments({ "x.0": { $exists: true } }),
        accents.countDocuments({ a: { $ne: null } }),
        accents.countDocuments({ a: true }),
        accents.countDocuments({ a: false }),
    ]);

    return { words, fromCorpus, fromChants, fromLexicon, compared, agree, disagree };
};
