import { isFootnoteBook } from "@/utils/texts";
import { isCanonBook } from "@/utils/bibleCanon";

/**
 * Библейская сноска — внутрь, а не наружу.
 *
 * Сноска в чтении подписана «Быт.1:1», и до сих пор такая ссылка вела на
 * azbyka.ru: своей Библии у сайта не было. Теперь она есть, у каждого стиха
 * есть якорь, и уводить читателя за той же самой книгой на чужой сайт больше
 * незачем.
 *
 * Наружу ведём только то, чего у нас НЕТ: в bookMap есть сокращения книг,
 * которых наши издания не содержат, и для них внешняя ссылка остаётся
 * честным ответом.
 */
export interface FootnotePlace {
    chapter: number;
    /** null — назван не стих, а вся глава («Пс.50»). */
    verse: number | null;
}

/**
 * «1:1», «1:1-5», «1:1,5», «3» -> куда вести.
 *
 * Диапазон и перечисление ведём на ПЕРВЫЙ стих: показывается всё равно глава
 * целиком, а якорь нужен, чтобы не искать место глазами.
 */
export const parseFootnotePlace = (place?: string): FootnotePlace | null => {
    const raw = (place || "").trim();
    if (!raw) return null;

    const [chapterPart, versePart] = raw.split(":");
    const chapter = Number(chapterPart.match(/\d+/)?.[0]);
    if (!Number.isInteger(chapter) || chapter < 1) return null;

    if (versePart === undefined) return { chapter, verse: null };
    const verse = Number(versePart.match(/\d+/)?.[0]);
    return { chapter, verse: Number.isInteger(verse) && verse > 0 ? verse : null };
};

/** Адрес сноски у нас; null — книгу или место разобрать не удалось. */
export const footnoteHref = (footnote?: string): string | null => {
    const { isBook, bookSlug, probablePlace } = isFootnoteBook(footnote);
    if (!isBook || !bookSlug || !isCanonBook(bookSlug)) return null;

    const place = parseFootnotePlace(probablePlace);
    if (!place) return null;

    return `/bible/${bookSlug}/${place.chapter}`
        + (place.verse ? `#v${place.verse}` : "");
};
