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
import { BibleCanonBook, canonBook } from "@/utils/bibleCanon";
import { AppendixBook, appendixBook } from "@/utils/bibleAppendix";

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
