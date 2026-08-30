// Ссылки на стих в каноне: как стих адресуется поверх разных изданий.
//
// У издания две нумерации разом. РОДНАЯ (`chapter`/`verse`) — та, что напечатана
// в самом издании, ею стих показывается читателю. КАНОНИЧЕСКАЯ (`canonRef`,
// `canonSort`) — приведённая к эталону, ею стих сопоставляется с другими изданиями
// и по ней резолвятся зачала. У церковнославянской Библии обе совпадают: она и есть
// эталон. У румынской 1688 года — расходятся: Песнь трёх отроков там издана
// отдельной книгой, а в каноне это Дан 3:24–90.
//
// Отсюда правило: показ берёт chapter/verse, поиск и параллель — canonRef/canonSort.
import { IVerseRange, verseOrder } from "@/utils/verses";
import { isCanonBook } from "@/utils/bibleCanon";

export interface CanonRef {
    canonId: string;
    chapter: number;
    verse: number;
}

/**
 * Место стиха в каноническом порядке книги — одним сортируемым числом.
 * Та же формула, что у verseOrder: числа из базы и числа, посчитанные на лету,
 * обязаны быть сравнимы напрямую.
 */
export const canonSort = (chapter: number, verse: number): number => verseOrder(chapter, verse);

export const formatCanonRef = (canonId: string, chapter: number, verse: number): string =>
    `${canonId}.${chapter}.${verse}`;

/**
 * Разбор «daniila.3.24». Идентификатор книги может содержать точки не больше, чем
 * содержит его слуг (а он их не содержит), поэтому берём два последних поля с конца —
 * так разбор не сломается, если в слуге когда-нибудь окажется точка.
 */
export const parseCanonRef = (ref: string | null | undefined): CanonRef | null => {
    if (!ref) return null;

    const parts = ref.split(".");
    if (parts.length < 3) return null;

    const verse = Number(parts.pop());
    const chapter = Number(parts.pop());
    const canonId = parts.join(".");

    if (!canonId || !Number.isInteger(chapter) || !Number.isInteger(verse)) return null;
    if (chapter < 1 || verse < 1) return null;

    return { canonId, chapter, verse };
};

/** Тот же разбор, но с проверкой, что книга и правда есть в каноне. */
export const parseKnownCanonRef = (ref: string | null | undefined): CanonRef | null => {
    const parsed = parseCanonRef(ref);
    return parsed && isCanonBook(parsed.canonId) ? parsed : null;
};

/**
 * Диапазоны зачала — в условие Mongo по canonSort.
 *
 * Пустой список диапазонов означает «вся книга» (так его понимает
 * filterVersesByRanges), и здесь он даёт null: подставлять в запрос нечего,
 * фильтра по стихам просто не будет. Возвращать `{ $or: [] }` нельзя — Mongo
 * считает пустой $or ошибкой и уронил бы запрос вместо выдачи всей книги.
 */
export const rangesToCanonSortFilter = (
    ranges: IVerseRange[] | null | undefined,
): { $or: Array<{ canonSort: { $gte: number; $lte: number } }> } | null => {
    if (!ranges?.length) return null;

    return {
        $or: ranges.map((range) => ({
            canonSort: {
                $gte: canonSort(range.chapterFrom, range.verseFrom),
                $lte: canonSort(range.chapterTo, range.verseTo),
            },
        })),
    };
};

/**
 * Сколько стихов ожидает зачало, если считать по эталонной версификации.
 *
 * Нужно для честного фолбека: издание может знать книгу, но не знать половины
 * диапазона (румынский Даниил короче славянского на две главы), и тогда чтение
 * молча обрывается. Сравнив ожидаемое с найденным, такой случай видно.
 *
 * `chapterLengths` — длины глав книги в эталоне, по индексу главы минус один.
 * Стихи вне известных глав в счёт не идут: их нет и в эталоне.
 */
export const expectedVerseCount = (
    ranges: IVerseRange[] | null | undefined,
    chapterLengths: number[] | null | undefined,
): number | null => {
    if (!chapterLengths?.length) return null;

    const lengthOf = (chapter: number): number => chapterLengths[chapter - 1] ?? 0;

    if (!ranges?.length) {
        return chapterLengths.reduce((sum, length) => sum + length, 0);
    }

    // Диапазоны зачала могут пересекаться (в одном чтении дважды помянут один стих),
    // поэтому считаем по множеству, а не суммой длин.
    const counted = new Set<number>();

    ranges.forEach((range) => {
        const from = canonSort(range.chapterFrom, range.verseFrom);
        const to = canonSort(range.chapterTo, range.verseTo);
        if (to < from) return;

        for (let chapter = range.chapterFrom; chapter <= range.chapterTo; chapter++) {
            const length = lengthOf(chapter);
            for (let verse = 1; verse <= length; verse++) {
                const order = canonSort(chapter, verse);
                if (order >= from && order <= to) counted.add(order);
            }
        }
    });

    return counted.size;
};
