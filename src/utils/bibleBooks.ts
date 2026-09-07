// Книга Библии по идентификатору — из канона ИЛИ из приложения.
//
// Раздел Библии показывает и то, и другое: он про то, что напечатано в
// изданиях. Устав — только про канон: зачало не может быть назначено на Еноха.
// Поэтому лукапа два, и выбор между ними — не формальность.
//
//   canonBook  (@/utils/bibleCanon)   — устав, зачала, сноски, карта книг;
//   bibleBook  (здесь)                — раздел Библии, импорт изданий, оглавление.
//
// Правило простое: если ответ влияет на службу — canonBook; если на показ
// книги, которую издание напечатало, — bibleBook.
import { BibleCanonBook, BibleSection, BIBLE_CANON, canonBook } from "@/utils/bibleCanon";
import { AppendixBook, BIBLE_APPENDIX, appendixBook } from "@/utils/bibleAppendix";
import { referenceChapterCount } from "@/utils/bibleVersification";

export interface BibleBookRef {
    id: string;
    name: string;
    abbr: string;
    /** false для книг приложения: их канон не держит. */
    inCanon: boolean;
    canon: BibleCanonBook | null;
    appendix: AppendixBook | null;
}

export const bibleBook = (id: string | null | undefined): BibleBookRef | null => {
    const canon = canonBook(id);
    if (canon) {
        return { id: canon.id, name: canon.name, abbr: canon.abbr, inCanon: true, canon, appendix: null };
    }

    const appendix = appendixBook(id);
    if (appendix) {
        return {
            id: appendix.id, name: appendix.name, abbr: appendix.abbr,
            inCanon: false, canon: null, appendix,
        };
    }

    return null;
};

export const isBibleBook = (id: string | null | undefined): boolean => bibleBook(id) !== null;

/**
 * Книга в оглавлении: то, чем канон и приложение выглядят снаружи.
 *
 * Заведено ради ручки `/api/v2/bible/books`, но нарочно живёт здесь, а не в
 * сериализаторе API: снаружи и внутри это один и тот же список, и заводить ему
 * вторую форму значило бы завести место, где они разойдутся.
 */
export interface BibleBookEntry {
    id: string;
    name: string;
    abbr: string;
    /** Раздел канона; `appendix` — книга, которую канон не держит. */
    section: BibleSection | "appendix";
    inCanon: boolean;
    /**
     * Сколько в книге канонических глав — по эталонной версификации.
     *
     * У приложения `null`, а не `0`: эталон снят с церковнославянского издания, а
     * этих книг в нём нет вовсе — потому они и в приложении. Ноль сказал бы
     * «глав нет», и это была бы неправда; `null` говорит «мы не считали».
     */
    chapters: number | null;
    /** Откуда книга взялась и почему стоит вне канона; только у приложения. */
    note?: string;
}

/**
 * Оглавление Библии: 77 книг канона, следом книги приложения.
 *
 * Порядок значим и является частью ответа: канон идёт в порядке Елизаветинской
 * Библии (соборные послания перед посланиями ап. Павла, неканонические книги на
 * своих местах), а не по алфавиту и не по разделам. Клиенту, который группирует
 * по `section`, порядок внутри раздела достаётся даром; клиенту, который
 * пересортирует, — восстанавливать его будет неоткуда, и об этом сказано в
 * описании ручки.
 */
export const bibleBookList = (): BibleBookEntry[] => [
    ...BIBLE_CANON.map((book) => ({
        id: book.id,
        name: book.name,
        abbr: book.abbr,
        section: book.section,
        inCanon: true,
        // Число глав берём из эталона, а не из базы: он уже в коде, и оглавление
        // канона не должно стоить семидесяти семи запросов.
        chapters: referenceChapterCount(book.id),
    })),
    ...BIBLE_APPENDIX.map((book) => ({
        id: book.id,
        name: book.name,
        abbr: book.abbr,
        section: "appendix" as const,
        inCanon: false,
        chapters: null,
        note: book.note,
    })),
];
