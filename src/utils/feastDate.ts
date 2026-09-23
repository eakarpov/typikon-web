// Дата престольного праздника — чистая арифметика, без базы.
//
// Вынесено из @/lib/temples, где выборки ходят в Mongo: эту же арифметику
// считают свод «что рядом» и дни поездки, и проверять её тестом, поднимая
// подключение к базе, незачем.

import { orthodoxEaster } from "date-easter";

export interface TempleFeast {
    month?: number;
    day?: number;
    paschaOffset?: number;
    note?: string;
    memoryId?: string | null;
    memoryLabel?: string | null;
    sign?: string | null;
}

/**
 * Гражданская дата престольного праздника в этом году.
 *
 * Неподвижная память напечатана в Минее по СТАРОМУ стилю, и к ней прибавляются
 * те же тринадцать дней, на которые церковная дата отстаёт в @/lib/calcDay.
 * Подвижная считается от Пасхи — и потому у Троицкого храма престольный
 * праздник каждый год в разный день; этого не показывает ни один календарь,
 * потому что списка престолов ни у кого нет.
 */
export const feastDate = (feast: TempleFeast, year: number): Date | null => {
    if (feast.paschaOffset !== undefined) {
        const e = orthodoxEaster(year);
        const pascha = new Date(Date.UTC(e.year, e.month - 1, e.day));
        pascha.setUTCDate(pascha.getUTCDate() + feast.paschaOffset);
        return pascha;
    }
    if (feast.month === undefined || feast.day === undefined) return null;
    const d = new Date(Date.UTC(year, feast.month - 1, feast.day));
    d.setUTCDate(d.getUTCDate() + 13);
    return d;
};

/**
 * Ближайший праздник из списка, считая с `from` включительно.
 *
 * Смотрим два года: праздник, прошедший в этом году, ближе всего в следующем, а
 * подвижный — каждый год на другом месте, и простого «прибавить год» ему мало.
 */
export const nextFeast = <F extends TempleFeast>(feasts: F[], from: Date): { feast: F; date: Date } | null => {
    const year = from.getUTCFullYear();
    let best: { feast: F; date: Date } | null = null;
    for (const feast of feasts) {
        for (const y of [year, year + 1]) {
            const date = feastDate(feast, y);
            if (!date || date.getTime() < from.getTime()) continue;
            if (!best || date.getTime() < best.date.getTime()) best = { feast, date };
            break;
        }
    }
    return best;
};

/** Праздники, приходящиеся на промежуток [from, to] включительно, по возрастанию даты. */
export const feastsBetween = <F extends TempleFeast>(feasts: F[], from: Date, to: Date): { feast: F; date: Date }[] => {
    const hits: { feast: F; date: Date }[] = [];
    for (const feast of feasts) {
        for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) {
            const date = feastDate(feast, y);
            if (date && date.getTime() >= from.getTime() && date.getTime() <= to.getTime()) hits.push({ feast, date });
        }
    }
    return hits.sort((a, b) => a.date.getTime() - b.date.getTime());
};
