import { BIBLE_CANON, BibleSection } from "@/utils/bibleCanon";

/**
 * Объём издания — что оно СОБОЙ ПРЕДСТАВЛЯЕТ, а не что успело приехать.
 *
 * ЗАЧЕМ ОБЪЯВЛЯТЬ, А НЕ ВЫВОДИТЬ ИЗ ЗАВЕЗЁННОГО. Пока все издания были полными
 * Библиями, вопрос не стоял: нет книги — недоделка. С частичными переводами —
 * а они нужны для последований, на китайском и японском полной Библии может и
 * не быть вовсе — «нет книги» перестаёт значить одно. Четвероевангелие не
 * содержит Деяний не по недосмотру, и звать это дырой было бы враньём; а вот
 * Четвероевангелие без Марка — именно дыра.
 *
 * Это та же развилка, что у приговоров главам в @/lib/bible/mappings: там
 * разведены «сверено» и «руки не дошли», здесь — «издание этого не содержит» и
 * «мы ещё не завезли». Молчание в обоих случаях читается как второе.
 *
 * ОБЪЁМ НЕ ЗАМЕНЯЕТ ПРОВЕРКИ. Он говорит, чего ЖДАТЬ; сошлось ли ожидаемое с
 * привезённым — считает сверка версификации.
 */
export type BibleScopeId =
    "full" | "nt" | "nt-lectionary" | "gospels" | "apostle" | "psalter";

const SECTIONS: Record<Exclude<BibleScopeId, "full">, BibleSection[] | null> = {
    nt: ["gospel", "apostle", "revelation"],
    // Новый Завет, каким его печатают для церкви: всё, что читается за
    // богослужением, и ничего сверх того. Откровение не читается — и его в
    // такой книге нет. Это не «недовезли», а состав издания: китайский
    // Новый Завет 1910 года набран ровно так, 26 книг и 238 глав.
    "nt-lectionary": ["gospel", "apostle"],
    gospels: ["gospel"],
    // Апостол богослужебный — Деяния и послания; Откровение за литургией не
    // читается, и в такое издание оно обычно не входит.
    apostle: ["apostle"],
    psalter: null,
};

export const BIBLE_SCOPES: Array<{ id: BibleScopeId; title: string }> = [
    { id: "full", title: "полная Библия" },
    { id: "nt", title: "Новый Завет" },
    { id: "nt-lectionary", title: "Новый Завет без Апокалипсиса" },
    { id: "gospels", title: "Четвероевангелие" },
    { id: "apostle", title: "Апостол" },
    { id: "psalter", title: "Псалтирь" },
];

export const DEFAULT_BIBLE_SCOPE: BibleScopeId = "full";

export const bibleScopeTitle = (scope: string | null | undefined): string =>
    BIBLE_SCOPES.find((entry) => entry.id === scope)?.title
    ?? BIBLE_SCOPES.find((entry) => entry.id === DEFAULT_BIBLE_SCOPE)!.title;

/** Книги канона, которых от издания такого объёма ждём. */
export const bibleScopeBooks = (scope: string | null | undefined): Set<string> => {
    if (!scope || scope === "full" || !(scope in SECTIONS)) {
        return new Set(BIBLE_CANON.map((book) => book.id));
    }
    if (scope === "psalter") return new Set(["psaltir"]);
    const sections = SECTIONS[scope as Exclude<BibleScopeId, "full">]!;
    return new Set(BIBLE_CANON.filter((book) => sections.includes(book.section)).map((b) => b.id));
};

/** Книга вне объявленного объёма: её отсутствие — не недоделка. */
export const outsideBibleScope = (scope: string | null | undefined, canonId: string): boolean =>
    !bibleScopeBooks(scope).has(canonId);
