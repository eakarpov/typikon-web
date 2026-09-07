import * as ch from "@/utils/chronology";
import { Field, FIELDS, Record_ } from "@/lib/dating";

// Разбор условий летописной записи из параметров запроса.
//
// Жил внутри компонента страницы, пока читателя было двое — форма и её же
// адрес. С появлением ручки API читателей стало трое, и проверка диапазонов,
// переписанная во втором месте, однажды разошлась бы с первым: индикт от 1 до
// 15 здесь и от 0 до 15 там дают разные ответы на одну и ту же запись.

/** Границы циклов. Значение вне них — не описка источника, а описка набора. */
const RANGES: Partial<Record<Field, [number, number]>> = {
    indikt: [1, 15],
    krugSolntsu: [1, 28],
    krugLune: [1, 19],
    vrutseleto: [1, 7],
    osnovanie: [1, 30],
    epakta: [0, 30],
};

export const numeric = (
    value: string | undefined | null,
    min: number,
    max: number,
): number | undefined => {
    if (!value) return undefined;
    const n = Number(String(value).replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

/** Что из параметров удалось прочесть как условие записи. */
export const readRecord = (params: Record<string, string | undefined>): Record_ => {
    const record: Record_ = {};

    for (const field of FIELDS) {
        const bounds = RANGES[field];
        if (bounds) {
            const value = numeric(params[field], bounds[0], bounds[1]);
            if (value !== undefined) (record as any)[field] = value;
        }
    }

    const letter = (params.klyuchGranits || "").trim();
    if (letter && ch.KLYUCH_LETTERS.includes(letter as any)) record.klyuchGranits = letter;

    const weekday = (params.weekday || "").trim();
    if (ch.WEEKDAYS.includes(weekday as ch.Weekday)) record.weekday = weekday as ch.Weekday;

    record.leto = numeric(params.leto, 1, 9999);

    const month = numeric(params.month, 1, 12);
    const day = numeric(params.day, 1, 31);
    // Месяц без числа день не задаёт, а число без месяца тем более: они идут
    // только парой, иначе перебору нечего прикладывать ко дню недели.
    if (month && day) {
        record.month = month;
        record.day = day;
    }

    return record;
};

/** Названо ли хоть одно условие. Пустая запись — не вопрос, а пустой бланк. */
export const asked = (record: Record_): boolean =>
    Object.values(record).some(value => value !== undefined);

/** Все имена условий, которые понимает разбор. */
export const RECORD_PARAMS: string[] = [...FIELDS, "leto", "month", "day"];

/**
 * Условия, которые назвали, но прочесть не удалось.
 *
 * Молча выбросить непонятое — худшее, что здесь можно сделать. Записавший
 * «в неделю» (а решатель знает «воскресенье») получил бы ответ, выглядящий
 * подтверждённым днём недели, тогда как день недели в переборе не участвовал
 * вовсе. Пусть лучше ответ сам скажет, чего в нём нет.
 *
 * Месяц и число идут парой: назвать одно без другого — тоже не прочесть.
 */
export const ignoredParams = (
    params: Record<string, string | undefined>,
    record: Record_,
): string[] =>
    RECORD_PARAMS.filter(name => {
        const given = (params[name] ?? "").trim();
        if (!given) return false;
        return (record as any)[name] === undefined;
    });
