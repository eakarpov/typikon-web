import { cached, CacheTag } from "@/lib/cache";
import { monthDates, ordoDay, ordoRange, type OrdoDay, type OrdoFastingRule } from "@/lib/ordo";
import { chosenVariant, shadeOf } from "@/lib/trapeza/core";

// Спрос трапезы у движка устава.
//
// Кэш стоит ЗДЕСЬ, снаружи вызова, и никогда внутри другого кэша: обёртка
// `unstable_cache`, вложенная в такую же, молча теряет дни — на этом уже
// обжигалось приходское расписание (см. предупреждение в parish/engine.ts).
//
// Час — не про свежесть данных, а про страховку: устав на прошедшую дату не
// меняется вовсе, а на будущую — только вместе с выкладкой движка, которая
// сбрасывает тег сама.

export const trapezaDay = cached(
    (date: string) => ordoDay(date),
    ["trapeza-day"],
    [CacheTag.ORDO],
    3600,
);

/** День месячной сетки: только то, что помещается в клетку. */
export interface TrapezaCell {
    date: string;
    /** Число месяца. */
    day: number;
    weekday: string;
    weekdayLabel: string;
    /** Разрешение коротко — «сухоядение», «елей и вино». */
    allowLabel: string | null;
    /** Ступень строгости для краски. */
    shade: number | null;
    periodLabel: string | null;
    /** Главы книги расходятся: в клетке один ответ показывать нельзя. */
    disputed: boolean;
    /** Ответ выведен нами, а не сказан книгой. */
    ourReading: boolean;
    /** Книга разводит сословия — в клетке они не помещаются. */
    estates: boolean;
}

export interface TrapezaMonth {
    year: number;
    month: number;
    cells: TrapezaCell[];
    /** Даты, на которые движок не ответил: пустоту не выдаём за «поста нет». */
    failed: string[];
}

// Из ответа движка берём в клетку строгейшее правило: где книга разводит
// монаха и мирянина, в сетке им не разойтись, и показать послабление вместо
// строгости значило бы соврать в сторону, в которую врать нельзя. Что
// сословия разведены, клетка отмечает признаком, а сам ответ — на дне.
const strictest = (rules: OrdoFastingRule[]): OrdoFastingRule | null =>
    rules.reduce<OrdoFastingRule | null>(
        (worst, rule) => (!worst || shadeOf(rule.allow) < shadeOf(worst.allow) ? rule : worst),
        null,
    );

const cellOf = (date: string, day: OrdoDay | undefined): TrapezaCell => {
    const number = Number(date.slice(8, 10));
    const variant = chosenVariant(day ?? null);
    const rules = variant?.fasting ?? [];
    const lead = strictest(rules);
    return {
        date,
        day: number,
        weekday: day?.weekday ?? "",
        weekdayLabel: day?.weekdayLabel ?? "",
        allowLabel: lead?.allowLabel ?? null,
        shade: lead ? shadeOf(lead.allow) : null,
        periodLabel: lead?.periodLabel ?? null,
        disputed: rules.some(r => r.disputed),
        ourReading: rules.length > 0 && rules.every(r => r.ourReading),
        estates: new Set(rules.map(r => r.who ?? "")).size > 1,
    };
};

const buildMonth = async (year: number, month: number): Promise<TrapezaMonth> => {
    // Лишний день, который добавляет monthDates ради вечернего стояния,
    // сетке не нужен: трапеза — свойство суток, а не вечера накануне.
    const dates = monthDates(year, month).filter(d => d.slice(0, 7) === `${year}-${String(month).padStart(2, "0")}`);
    const { days, failed } = await ordoRange(dates);
    return { year, month, cells: dates.map(d => cellOf(d, days.get(d))), failed };
};

export const trapezaMonth = cached(
    buildMonth,
    ["trapeza-month"],
    [CacheTag.ORDO],
    3600,
);
