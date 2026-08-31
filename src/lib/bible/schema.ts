// Хранение Библий: издание — книга издания — стих.
//
// Отдельно от `texts`/`verses` потому, что у Библии своя идентичность. Библейский
// стих опознаётся не тем, в каком тексте он лежит, а тем, какое место канона
// занимает: «Дан. 3:24» — это Дан. 3:24 в любом издании, даже когда одно печатает
// его двадцать четвёртым стихом главы, а другое — первым стихом отдельной книги.
// Богослужебный текст, наоборот, опознаётся местом в службе, и общей модели у них
// нет — попытка одной кончается тем, что у Бытия заводится поле «возглас иерея».
//
// ДВЕ НУМЕРАЦИИ У КАЖДОГО СТИХА, и путать их нельзя:
//   chapter/verse            — РОДНАЯ, как напечатано в этом издании;
//   canonChapter/canonVerse  — КАНОНИЧЕСКАЯ, приведённая правилами к эталону.
// Родная нужна, чтобы читатель нашёл стих в бумажной книге; каноническая — чтобы
// зачало нашло стих, а параллельный вид свёл издания в одну строку.
// У церковнославянского издания обе совпадают: оно и есть эталон.
import { ObjectId } from "mongodb";
import { BibleMappingRule } from "@/lib/bible/mappings";

export const BIBLE_EDITIONS = "bible_editions";
export const BIBLE_BOOKS = "bible_books";
export const BIBLE_VERSES = "bible_verses";

export interface BibleEdition {
    _id: ObjectId;
    /** Устойчивый человекочитаемый код: «cs-eliz», «ro-1688». По нему ищут издание. */
    code: string;
    /**
     * Язык для выбора издания — значения cookie `bibleLang` (@/utils/bibleLanguage).
     * Язык и издание разведены намеренно: изданий на одном языке может быть много,
     * и прежняя схема «одно издание на язык» упиралась в это потолком.
     */
    langCode: string;
    /** Начертание для показа — коды из @/utils/bookLanguages («cu», «ro_cyr»). */
    language: string;
    /** Какое издание берётся, когда язык выбран, а издание — нет. */
    isDefaultForLang: boolean;
    title: string;
    /** Подпись колонки в параллельном виде: «ЦС», «РУМ». */
    shortTitle: string;
    /** Традиция нумерации; «sla-lxx» — эталон, к которому приводятся остальные. */
    versification: string;
    /**
     * Объявленный объём (@/utils/bibleScope): «full», «nt», «gospels»…
     * Отличает «издание этого не содержит» от «мы ещё не завезли»: без него
     * Четвероевангелие выглядело бы Библией с шестьюдесятью дырами.
     */
    scope: string;
    /**
     * Канон традиции (@/utils/bibleEditionCanon): «sla», «grc-lxx», «la-vulgata».
     * Ось, отдельная от объёма: объём говорит, сколько своего канона несёт это
     * издание, канон — чего у традиции нет вовсе. У латинской нет 3 Маккавейской
     * не потому, что издание неполно, а потому что её там никогда не было.
     */
    canon: string;
    year: number | null;
    sourceLink: string;
    /** Карточка издания в библиотеке (`books`), если она заведена. */
    bookId: ObjectId | null;
    /** Правила приведения к канону — копия @/lib/bible/mappings для этого издания. */
    mapping: BibleMappingRule[];
    order: number;
    public: boolean;
    updatedAt: Date;
}

export interface BibleBook {
    /** Совпадает с прежним `texts._id`: на него ссылаются закладки и заметки читателей. */
    _id: ObjectId;
    editionId: ObjectId;
    /**
     * Идентификатор книги, КАК ОНА НАПЕЧАТАНА в издании. Обычно совпадает с canonId,
     * но не всегда: в румынской Библии история Сусанны издана отдельной книгой
     * («susanny»), а в каноне это тринадцатая глава Даниила.
     */
    slug: string;
    /** Книга канона, которой эта принадлежит (@/utils/bibleCanon). */
    canonId: string;
    name: string;
    /** Прежний адрес чтения; с него ведёт постоянный редирект в раздел Библии. */
    alias: string;
    order: number;
    updatedAt: Date;
}

export interface BibleVerse {
    /** Совпадает с прежним `verses._id`: по нему правят ударения (@/scripts/lib/corpus). */
    _id: ObjectId;
    editionId: ObjectId;
    /** Книга издания, в которой стих напечатан (`bible_books._id`). */
    bookId: ObjectId;
    /** Книга канона — она же ключ поиска зачал и параллели. */
    canonId: string;
    /** Родная нумерация издания — для показа. */
    chapter: number;
    verse: number;
    /** Каноническая нумерация — для поиска и сопоставления. */
    canonChapter: number;
    canonVerse: number;
    /** «daniila.3.24» — ключ, по которому издания сходятся в одну строку. */
    canonRef: string;
    /** canonChapter/canonVerse одним сортируемым числом (@/lib/bible/refs). */
    canonSort: number;
    content: string;
    updatedAt: Date;
}
