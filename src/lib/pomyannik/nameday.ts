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
