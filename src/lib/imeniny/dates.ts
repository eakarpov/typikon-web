import { getPaschaDate } from "@/utils/lectionaryCycle";

// Дни памяти в гражданский календарь — и правило именин.
//
// ДНИ ПАМЯТИ ДВУХ РОДОВ, и путать их нельзя. «01.04» — число месяцеслова:
// оно одно и то же всякий год, но записано по старому стилю, и в гражданском
// календаре стоит на тринадцать дней позже. «-14» — смещение от Пасхи: такая
// память ходит по календарю вместе с ней, и в разные годы приходится на разные
// числа. Мария Египетская памятуется и так и так, и обе её памяти настоящие.
//
// Тринадцать дней верны для 1900–2099: дальше расхождение календарей меняется,
// и об этом сказано там же, где оно уже посчитано (@/utils/lectionaryCycle).

const DAY_MS = 24 * 3600 * 1000;
const OLD_STYLE_OFFSET_DAYS = 13;

export type MemoryDate =
    | { kind: "fixed"; month: number; day: number }
    | { kind: "movable"; offset: number };

/** «01.04» — первое апреля старого стиля; «-14» — за две недели до Пасхи. */
export const parseMemoryDate = (raw: string): MemoryDate | null => {
    const value = String(raw ?? "").trim();
    const fixed = /^(\d{1,2})\.(\d{1,2})$/.exec(value);
    if (fixed) {
        const day = Number(fixed[1]);
        const month = Number(fixed[2]);
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        return { kind: "fixed", month, day };
    }
    const movable = /^-?\d{1,3}$/.exec(value);
    if (movable) return { kind: "movable", offset: Number(value) };
    return null;
};

const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * День памяти в гражданской дате нужного года.
 *
 * Неподвижная память переводится сдвигом календарей, подвижная — отсчётом от
 * Пасхи этого года. Оттого один и тот же святой в разные годы поминается в
 * разные числа, и именины по нему — тоже.
 */
export const civilDate = (date: MemoryDate, year: number): string => {
    if (date.kind === "movable") {
        return iso(new Date(+getPaschaDate(year) + date.offset * DAY_MS));
    }
    return iso(new Date(+new Date(year, date.month - 1, date.day) + OLD_STYLE_OFFSET_DAYS * DAY_MS));
};

export interface DatedMemory<T> {
    /** Гражданская дата в выбранном году. */
    date: string;
    /** Подвижная память в другой год придётся на другое число. */
    movable: boolean;
    item: T;
}

/** Все дни памяти записи, разложенные в гражданский календарь года. */
export const datesOf = <T>(raw: string[], year: number, item: T): Array<DatedMemory<T>> =>
    raw.flatMap(value => {
        const parsed = parseMemoryDate(value);
        if (!parsed) return [];
        return [{ date: civilDate(parsed, year), movable: parsed.kind === "movable", item }];
    });

/**
 * Именины: ближайшая память после дня рождения — включая сам этот день.
 *
 * ПРАВИЛО ЭТО НАРОДНОЕ, А НЕ УСТАВНОЕ, и здесь оно только считается. Церковь
 * единого порядка не устанавливает: где-то именины назначают по дню крещения,
 * где-то по восьмому дню от рождения, где-то по святому, чьё имя дали. Сказать
 * об этом обязана страница; дело этой функции — посчитать самый ходовой из
 * обычаев и не выдать его за единственный.
 *
 * Если после дня рождения памяти в этом году нет, берётся первая в следующем:
 * год круглый, и родившийся в декабре празднует в январе.
 */
export const nameDay = <T>(
    birthday: { month: number; day: number },
    memories: Array<DatedMemory<T>>,
): DatedMemory<T> | null => {
    if (!memories.length) return null;

    const key = (date: string) => date.slice(5); // «MM-DD»: год здесь не при чём
    const born = `${String(birthday.month).padStart(2, "0")}-${String(birthday.day).padStart(2, "0")}`;
    const sorted = [...memories].sort((a, b) => key(a.date).localeCompare(key(b.date)));

    return sorted.find(m => key(m.date) >= born) ?? sorted[0];
};
