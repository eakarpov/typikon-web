/**
 * Сколько чтений года издание может отдать.
 *
 * ЗАЧЕМ НЕ КНИГАМИ. «51 книга из 77» читателю не говорит ничего: книги разного
 * веса, и полтора десятка ветхозаветных, из которых не читают паремий, весят в
 * последованиях меньше одного Евангелия от Матфея. Мерить надо тем, что устав
 * на самом деле спрашивает, — ЗАЧАЛАМИ. Их 1067: Евангелие 400, Апостол 388,
 * Ветхий Завет 279. Четвероевангелие покроет 37% чтений года и ни одного
 * апостольского; Новый Завет — 73%. Вот это и надо показать перед выбором.
 *
 * Число считается прогоном настоящей резолюции (src/scripts/measure-pericope-
 * coverage.ts), а не прикидкой по составу: издание может знать книгу и не знать
 * половины отрезка — так румынский Даниил отдавал 33 стиха вместо 88, — и по
 * составу это выглядело бы полным покрытием.
 */
export interface PericopeCoverage {
    total: number;
    served: number;
    /** По разделам: gospel / apostle / ot — {total, served}. */
    parts?: Record<string, { total: number; served: number }>;
    measuredAt?: string | Date | null;
}

const PART_TITLES: Record<string, string> = {
    gospel: "Евангелие",
    apostle: "Апостол",
    ot: "Ветхий Завет",
};

export const coveragePercent = (coverage: { total: number; served: number }): number =>
    coverage.total ? Math.round((coverage.served / coverage.total) * 100) : 0;

/**
 * Строка о покрытии — или null, если мерить нечего либо покрыто всё.
 *
 * У ПОЛНОГО ПОКРЫТИЯ ПОМЕТЫ НЕТ намеренно: «отдаёт 100% чтений» — шум на всех
 * четырёх нынешних изданиях разом. Помета должна значить «тут есть чему не
 * найтись», а не украшать строку.
 */
export const coverageNote = (coverage: PericopeCoverage | null | undefined): string | null => {
    if (!coverage || !coverage.total) return null;
    const percent = coveragePercent(coverage);
    if (coverage.served >= coverage.total) return null;

    const parts = Object.entries(coverage.parts ?? {})
        .filter(([, part]) => part.total)
        .map(([key, part]) => {
            const title = PART_TITLES[key] ?? key;
            if (part.served === 0) return `${title} — нет`;
            if (part.served >= part.total) return `${title} — весь`;
            return `${title} — ${coveragePercent(part)}%`;
        });

    const tail = parts.length ? `: ${parts.join(", ")}` : "";
    return `отдаёт ${percent}% чтений года${tail}`;
};
