import { keyOf, nameEntry, type IndexedSaint } from "@/lib/imeniny/store";
import { civilDate, nameDay as nameDayRule, parseMemoryDate, type DatedMemory } from "@/lib/imeniny/dates";
import type { NameDay } from "@/lib/pomyannik/types";

// ИМЕНИНЫ ПО ДНЮ РОЖДЕНИЯ — ОБЫЧАЙ, А НЕ УСТАВ, и весь этот расчёт стоит ровно
// столько, сколько стоит обычай. Церковь единого порядка не устанавливает:
// где-то именины назначают по дню крещения, где-то по восьмому дню от рождения,
// где-то по святому, чьё имя дали при наречении. Мы считаем самый ходовой из
// обычаев — ближайшую память после дня рождения — и сказать об этом обязана
// карточка, как о том же сказано на странице /imeniny.
//
// Оттого посчитанное кладётся с пометой `auto` и уступает названному человеком:
// про своё крещение он знает больше нашего указателя.

/**
 * Именины по имени и дню рождения.
 *
 * Память возвращается в СВОЁМ виде — неподвижная числом месяцеслова, подвижная
 * смещением от Пасхи, — а не переведённой в гражданский календарь: перевод
 * зависит от года, и заранее посчитанное число однажды разойдётся со святцами.
 */
export const autoNameDay = async (
    name: string, born: string | null | undefined,
): Promise<NameDay | null> => {
    const key = keyOf(name);
    const birthday = parseBirthday(born);
    if (!key || !birthday) return null;

    const entry = await nameEntry(key);
    if (!entry?.saints?.length) return null;

    const year = new Date().getFullYear();
    const memories: Array<DatedMemory<{ raw: string; saint: IndexedSaint }>> = [];
    for (const saint of entry.saints) {
        for (const raw of saint.dates ?? []) {
            const parsed = parseMemoryDate(raw);
            if (!parsed) continue;
            memories.push({
                date: civilDate(parsed, year),
                movable: parsed.kind === "movable",
                item: { raw, saint },
            });
        }
    }
    if (!memories.length) return null;

    const chosen = nameDayRule(birthday, memories);
    if (!chosen) return null;

    const parsed = parseMemoryDate(chosen.item.raw);
    if (!parsed) return null;

    const saint = chosen.item.saint.name ?? null;
    return parsed.kind === "movable"
        ? { source: "auto", offset: parsed.offset, saint }
        : { source: "auto", style: "old", month: parsed.month, day: parsed.day, saint };
};

const parseBirthday = (raw: string | null | undefined) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw ?? ""));
    if (!m) return null;
    const month = Number(m[2]), day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { month, day };
};

export interface NameDayOption {
    /** Чем эта память записана в святцах: «01.04» либо «-14». */
    value: string;
    /** Гражданская дата в нынешнем году — для подписи. */
    date: string;
    movable: boolean;
    saint: string;
    /** Имя вынуто из соборной памяти догадкой, а не стоит своим местом. */
    guess: boolean;
    /**
     * Готовая запись именин. Считается ЗДЕСЬ, на сервере: разбор памяти живёт в
     * lib/imeniny, а тот тянет за собою базу, и повторять его на странице ради
     * одного выбора значило бы завести вторую правду о том, что такое «01.04».
     */
    nameDay: NameDay;
}

/**
 * ВСЕ ДНИ ИМЕНИ — чтобы человек выбрал свои.
 *
 * Расчёт по дню рождения даёт один ответ, а памятей у имени бывает десяток, и
 * ответ этот — самый ходовой обычай, а не единственный: именины назначают и по
 * дню крещения, и по восьмому дню от рождения, и по тому святому, чьё имя дали
 * при наречении. Выбрать из перечня человек должен сам; наше дело — показать,
 * из чего выбирать, и не спрятать это за посчитанным.
 */
export const nameDayOptions = async (name: string): Promise<NameDayOption[]> => {
    const key = keyOf(name);
    if (!key) return [];

    const entry = await nameEntry(key);
    if (!entry?.saints?.length) return [];

    const year = new Date().getFullYear();
    const out: NameDayOption[] = [];
    const seen = new Set<string>();

    for (const saint of entry.saints) {
        for (const raw of saint.dates ?? []) {
            const parsed = parseMemoryDate(raw);
            if (!parsed) continue;
            const id = `${raw}:${saint.slug}`;
            if (seen.has(id)) continue;
            seen.add(id);
            out.push({
                value: raw,
                date: civilDate(parsed, year),
                movable: parsed.kind === "movable",
                saint: saint.name,
                guess: saint.confidence === "guess",
                nameDay: parsed.kind === "movable"
                    ? { source: "manual", offset: parsed.offset, saint: saint.name }
                    : { source: "manual", style: "old", month: parsed.month,
                        day: parsed.day, saint: saint.name },
            });
        }
    }

    return out.sort((a, b) => a.date.localeCompare(b.date));
};
