// Имя места для показа и адреса.
//
// Метки Wikidata — это имена элементов, а не мест: «Древний Египет», «Хорив (гора)»,
// «Тель-Хацор». Для заголовка страницы уточнение в скобках, описательное
// прилагательное и «Тель» (холм древнего города) лишние. Но только они: «Город
// Давида», «Держава Ахеменидов», «Долина полчища Гогова» — имена целиком, и без
// первого слова остаётся родительный падеж. Поиску по стихам нужно больше вариантов
// (@/lib/places/biblematch#nameVariants), заголовку — только эти.
//
// И короткое имя берётся, только если оно не принадлежит ещё какому-то месту: у
// «Древнего Египта» и «Эллинистического Египта» оно одно, и там уточнение и есть различие.

export const hasCyrillic = (s: string | undefined | null) => !!s && /[а-яё]/i.test(s);

export interface NamingRow { id: string; name: string; nameSource?: string }

const LEADING = /^(?:Древн(?:ий|яя|ее)|Эллинистическ(?:ий|ая|ое)|Римск(?:ий|ая|ое)|Тель)[\s-]+(?=[А-ЯЁ])/;

/**
 * Имя без уточнения в скобках, описательного прилагательного и «Тель». Если остаток
 * не начинается с заглавной (это уже не имя), возвращается исходное.
 */
export const stripDescriptors = (name: string): string => {
    const short = name.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim().replace(LEADING, "");
    return /^[А-ЯЁ]/.test(short) ? short : name;
};

/** Короткое имя по метке Wikidata; прочие имена (Никифор, редактор) не трогаются. */
export const shortName = (row: NamingRow): string =>
    row.nameSource === "wikidata" ? stripDescriptors(row.name) : row.name;

/**
 * Имена для показа по всему собранию: короткое, если оно ни с кем не совпало, иначе
 * исходное. Сравнение без регистра.
 */
export const displayNames = (rows: NamingRow[]): Map<string, string> => {
    const short = new Map(rows.map((r) => [r.id, shortName(r)]));
    const count = new Map<string, number>();
    for (const r of rows) {
        const keys = new Set([short.get(r.id)!.toLowerCase(), r.name.toLowerCase()]);
        for (const k of keys) count.set(k, (count.get(k) ?? 0) + 1);
    }
    return new Map(rows.map((r) => {
        const s = short.get(r.id)!;
        return [r.id, s !== r.name && (count.get(s.toLowerCase()) ?? 0) > 1 ? r.name : s];
    }));
};
