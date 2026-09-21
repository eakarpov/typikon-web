// Отступка и преступка рядовых чтений Евангелия и Апостола (по Пятидесятнице).
// Единая точка алгоритма: шаблоны days/weeks в базе не трогаются, сдвигается
// только то, ИЗ КАКОЙ седмицы берётся зачало на данный день.
//
// ПРАВИЛА ВЫВЕДЕНЫ СВЕРКОЙ, а не из пересказов. Опоры две:
//   * примечания Богослужебных указаний Издательского совета за 2025 и 2026 годы
//     («О Воздвиженской преступке…», «О Воздвиженской отступке…», «О Крещенской
//     отступке…») — в них правило сказано словами;
//   * Патриарший календарь по дням (зачала среды, воскресенья и дней вокруг
//     Богоявления) за циклы 2022–2026 годов — им проверен каждый шаг ниже.
// Прежняя версия держалась на двух пересказах и была неверна в трёх местах из
// четырёх: Лука начинался седмицей раньше срока, Апостол сдвигался вместе с
// Евангелием, а январский повтор считался от Богоявления ПРОШЛОГО года и до
// Недели о блудном сыне. Что подтверждено, а что нет — сказано у каждого правила.
//
// СЧЁТ НЕ СДВИГАЕТСЯ НИКОГДА. «Седмица N-я по Пятидесятнице» — всегда N-я по
// порядку, и закрывает её Неделя N-я. Сдвигается лишь зачало. Ключ карт ниже —
// этот счёт; значение — номер седмицы лекционария, чьё зачало читается.
//
// 1. ВОЗДВИЖЕНСКАЯ ПРЕСТУПКА И ОТСТУПКА — ТОЛЬКО ЕВАНГЕЛИЕ.
//    Лукин ряд (зачала 18-й седмицы) начинается с понедельника после Недели по
//    Воздвижении. Пусть эта Неделя — S-я по счёту. Тогда седмица S+1 читает
//    Евангелие 18-й, S+2 — 19-й и так далее; до неё — по порядку.
//      S = 17 — сдвига нет (подтверждено: 2023).
//      S < 17 — преступка: евангельские седмицы S+1…17 пропускаются
//               (подтверждено: 2024, S=14; 2022 и 2025, S=16).
//      S > 17 — отступка: седмицы 18…S читают Матфеевы зачала, кончая 11-й
//               седмицей: одна лишняя — 11-я (подтверждено: 2026, и сказано в
//               Указаниях: «читаются евангельские чтения 11-й, Матфеевой,
//               седмицы»); две — 10-я и 11-я (2010, по прежней сверке с
//               webtypikon.ru). Больше двух не бывает: S не превышает 19.
//    «Ряд чтений Апостола остаётся неизменным» (Указания, 29.09.2025 и
//    5.10.2026): Апостол в сентябре не сдвигается вовсе.
//
// 2. КРЕЩЕНСКАЯ ОТСТУПКА — И ЕВАНГЕЛИЕ, И АПОСТОЛ.
//    Последние седмицы перед Неделей о мытаре и фарисее считаются НАЗАД от неё:
//    седмица, которую закрывает Неделя о мытаре, читает 33-ю, перед ней — 32-ю
//    (о Закхее) и так далее. Блок начинается с первого понедельника не раньше
//    Богоявления (6 января ст. ст.), но не позже 34-й седмицы по счёту: после
//    33-й своего ряда нет. Подтверждено: цикл 2022 (32, 33), 2024 (31, 32, 33 —
//    по Евангелию, ушедшему на три седмицы вперёд), 2025 (32, 33), 2023 (30, 31,
//    17, 32, 33). В блоке из пяти третьей с конца читается 17-я седмица
//    (о хананеянке) — это подтверждено; что в блоке из четырёх её нет (30, 31, 32,
//    33), принято по обычному изложению правила и данными НЕ проверено: такого
//    года среди доступных нет. Блок из шести принят как 29-я впереди тех же пяти
//    и тоже не проверен.
//    До блока Апостол идёт по счёту, Евангелие — со своим сентябрьским сдвигом;
//    дойдя до 33-й раньше блока, оно на ней и стоит (в доступных годах не
//    встречалось).
//
// ЧЕГО ЗДЕСЬ НЕТ. Перестановок воскресных Евангелий в декабре (Недели праотец и
// отец), чтений суббот и Недель пред и по Рождестве и Богоявлении, переноса
// рядовых чтений с праздников на соседние дни. Это правила дня, а не ряда.
import { orthodoxEaster } from "date-easter";

const OLD_STYLE_OFFSET_DAYS = 13;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Первая седмица Лукина ряда в лекционарии. */
const LUKE_FIRST_WEEK = 18;
/** Неделя по Воздвижении на этой седмице — сдвига нет. */
const NO_SHIFT_ELEVATION_WEEK = 17;
/** Матфеева седмица, которой кончается заполнение при отступке. */
const OTSTUPKA_LAST_FILLER_WEEK = 11;
const LAST_CANONICAL_WEEK = 33;
const CANAANITE_WEEK = 17;

/** Крещенский блок по длине: что читается, считая ОТ НАЧАЛА блока. */
const JANUARY_BLOCKS: Record<number, number[]> = {
    1: [33],
    2: [32, 33],
    3: [31, 32, 33],
    4: [30, 31, 32, 33],                        // не проверено данными
    5: [30, 31, CANAANITE_WEEK, 32, 33],
    6: [29, 30, 31, CANAANITE_WEEK, 32, 33],    // не проверено данными
};

export interface ILectionaryYear {
    /** Год Пятидесятницы, с которой идёт счёт; январь цикла — уже следующий год. */
    year: number;
    paschaDate: Date;
    pentecostDate: Date;
    /** Неделя по Воздвижении и её место в счёте. */
    elevationSunday: Date;
    elevationWeekNumber: number;
    /** Богоявление СЛЕДУЮЩЕГО года и Неделя по нём. */
    theophanySunday: Date;
    /** Неделя о мытаре и фарисее следующего года и её место в счёте. */
    publicanSunday: Date;
    publicanWeekNumber: number;
    /** `weeks` — на сколько седмиц Евангелие ушло вперёд (преступка) или отстало. */
    septemberAdjustment: { kind: "none" | "otstupka" | "prestupka"; weeks: number };
    /** Первая седмица крещенского блока по счёту и что в нём читается. */
    januaryBlockStart: number;
    januaryRepeatWeeks: number[];
    /** Счёт седмицы → седмица лекционария, чьё Евангелие читается. */
    gospelWeekMap: Map<number, number>;
    /** То же для Апостола. В сентябре он не сдвигается. */
    apostleWeekMap: Map<number, number>;
}

const addDays = (date: Date, days: number): Date => new Date(+date + days * DAY_MS);

// Первое воскресенье СТРОГО ПОСЛЕ указанной даты (даже если сама дата — воскресенье).
const strictlyNextSunday = (date: Date): Date => {
    const d = new Date(date);
    do {
        d.setDate(d.getDate() + 1);
    } while (d.getDay() !== 0);
    return d;
};

/** Понедельник не раньше указанной даты. */
const mondayOnOrAfter = (date: Date): Date => {
    const d = new Date(date);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    return d;
};

const diffWeeksRound = (from: Date, to: Date): number => Math.round((+to - +from) / (7 * DAY_MS));

export const getPaschaDate = (year: number): Date => {
    const e = orthodoxEaster(year);
    return new Date(e.year, e.month - 1, e.day);
};

// 14 сентября / 6 января по старому стилю -> дата в новом стиле (действительно для
// 1900–2099, далее сдвиг Юлианского/Григорианского календаря меняется).
const oldStyleToNewStyle = (year: number, month: number, day: number): Date =>
    addDays(new Date(year, month - 1, day), OLD_STYLE_OFFSET_DAYS);

/** Евангельская седмица до крещенского блока: счёт со сдвигом Лукина ряда. */
const gospelBeforeBlock = (count: number, elevationWeekNumber: number): number => {
    if (count <= Math.min(elevationWeekNumber, NO_SHIFT_ELEVATION_WEEK)) return count;
    if (count <= elevationWeekNumber) {
        // Отступка: седмицы 18…S читают Матфея, кончая 11-й седмицей.
        return OTSTUPKA_LAST_FILLER_WEEK - (elevationWeekNumber - count);
    }
    const week = LUKE_FIRST_WEEK + (count - elevationWeekNumber - 1);
    return Math.min(week, LAST_CANONICAL_WEEK);
};

export const computeLectionaryYear = (year: number): ILectionaryYear => {
    const paschaDate = getPaschaDate(year);
    const pentecostDate = addDays(paschaDate, 49);

    // === Воздвижение ===
    const elevationSunday = strictlyNextSunday(oldStyleToNewStyle(year, 9, 14));
    const elevationWeekNumber = diffWeeksRound(pentecostDate, elevationSunday);
    const shift = NO_SHIFT_ELEVATION_WEEK - elevationWeekNumber;
    const septemberAdjustment: ILectionaryYear["septemberAdjustment"] =
        shift > 0 ? { kind: "prestupka", weeks: shift }
        : shift < 0 ? { kind: "otstupka", weeks: -shift }
        : { kind: "none", weeks: 0 };

    // === Богоявление — следующего года: январь цикла лежит уже в нём ===
    const theophany = oldStyleToNewStyle(year + 1, 1, 6);
    const theophanySunday = strictlyNextSunday(theophany);
    const publicanSunday = addDays(getPaschaDate(year + 1), -70);
    const publicanWeekNumber = diffWeeksRound(pentecostDate, publicanSunday);

    // Седмица, начинающаяся понедельником M, закрывается воскресеньем M+6.
    const blockMondayWeek = diffWeeksRound(pentecostDate, addDays(mondayOnOrAfter(theophany), 6));
    const januaryBlockStart = Math.min(blockMondayWeek, LAST_CANONICAL_WEEK + 1, publicanWeekNumber);
    const blockLength = publicanWeekNumber - januaryBlockStart + 1;
    const januaryRepeatWeeks = JANUARY_BLOCKS[blockLength]
        // Длиннее шести блок не бывает; на случай иного — счёт назад без вставки.
        ?? Array.from({ length: blockLength }, (_, i) => LAST_CANONICAL_WEEK - (blockLength - 1 - i));

    const gospelWeekMap = new Map<number, number>();
    const apostleWeekMap = new Map<number, number>();
    for (let count = 1; count < januaryBlockStart; count++) {
        gospelWeekMap.set(count, gospelBeforeBlock(count, elevationWeekNumber));
        apostleWeekMap.set(count, Math.min(count, LAST_CANONICAL_WEEK));
    }
    januaryRepeatWeeks.forEach((week, i) => {
        gospelWeekMap.set(januaryBlockStart + i, week);
        apostleWeekMap.set(januaryBlockStart + i, week);
    });

    return {
        year, paschaDate, pentecostDate, elevationSunday, elevationWeekNumber,
        theophanySunday, publicanSunday, publicanWeekNumber,
        septemberAdjustment, januaryBlockStart, januaryRepeatWeeks, gospelWeekMap, apostleWeekMap,
    };
};
