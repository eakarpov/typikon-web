import { datesOf } from "@/lib/imeniny/dates";
import type { IndexedSaint, NameEntry } from "@/lib/imeniny/store";

// МОИ ИМЕНИНЫ — по имени из учётной записи.
//
// Раздел именин отвечает на вопрос «когда именины у Николая, рождённого в мае»,
// и отвечает одной датой. Здесь вопрос другой: «есть ли в ближайшие недели
// память святого с моим именем» — и дат может быть несколько, потому что дня
// рождения учётная запись не знает. Оттого это не «ваши именины», а «памяти
// святых с вашим именем»: назвать одну из них своей вправе только сам человек.

export interface NameDayAhead {
    /** Гражданская дата. */
    date: string;
    movable: boolean;
    saint: Pick<IndexedSaint, "slug" | "name" | "confidence">;
}

const addDaysIso = (iso: string, days: number): string => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

/**
 * Памяти святых с этим именем от `from` на `days` дней вперёд, по порядку дат.
 *
 * Раскладывается два года — нынешний и следующий: окно в декабре заходит в
 * январь, а подвижная память в следующем году придётся на другое число.
 */
export const nameDaysAhead = (entry: NameEntry | null, from: string, days: number): NameDayAhead[] => {
    if (!entry) return [];
    const until = addDaysIso(from, days);
    const year = Number(from.slice(0, 4));
    const out: NameDayAhead[] = [];
    const seen = new Set<string>();

    for (const saint of entry.saints) {
        for (const y of [year, year + 1]) {
            for (const memory of datesOf(saint.dates, y, saint)) {
                if (memory.date < from || memory.date > until) continue;
                const key = `${memory.date}:${saint.slug}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push({
                    date: memory.date,
                    movable: memory.movable,
                    saint: { slug: saint.slug, name: saint.name, confidence: saint.confidence },
                });
            }
        }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.saint.name.localeCompare(b.saint.name, "ru"));
};
