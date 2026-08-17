// Отступка и преступка евангельских/апостольских рядовых чтений (по Пятидесятнице).
// Единая точка алгоритма — если найдётся краевой случай, править только здесь,
// постоянные шаблоны days/weeks не трогаются.
//
// ВАЖНО (подтверждено сверкой с webtypikon.ru, ориентир — Патриарший календарь):
// Заголовок "Неделя N-я по Пятидесятнице" у самого дня НИКОГДА не сдвигается — недели
// всегда идут по порядку. Сдвигается только САМО ЗАЧАЛО, которое в этот день читается —
// это видно только в тексте службы ("Показать службу"), не в заголовке дня.
//
// Крестовоздвиженская (сентябрьская) отступка/преступка — про Евангельские зачала
// на Литургии. С понедельника по Неделе по Воздвижении по идее должно начинаться
// чтение 18-й седмицы (Лука), но по факту "Неделя по Воздвижении" может выпасть на
// любую календарную позицию. Если она наступает ПОЗЖЕ 18-й (Пасха ранняя, лишние
// недели) — отступка: на "лишних" календарных позициях (начиная с позиции 18) читаются
// зачала БОЛЕЕ РАННИХ недель, начиная с 10-й и далее по порядку (18→«Недели 10-й»,
// 19→«Недели 11-й», ...), пока на позиции (18 + излишек) не начнётся настоящая 18-я.
// Подтверждено примером 2010 года (Пасха 22 марта ст.ст., излишек 2 недели):
// календарная позиция 18 → зачало Недели 10-й, позиция 19 (по Воздвижении) →
// зачало Недели 11-й, с позиции 20 — настоящие 18-я и далее.
// Если Пасха поздняя (недостаток недель) — преступка: седмицы перед 18-й пропускаются
// целиком, чтобы 18-я (Лука) началась вовремя. Точный список пропускаемых номеров пока
// НЕ подтверждён примером (текущая реализация — рабочая гипотеза, требует проверки).
//
// Будничные (седмичные) Евангельские чтения сдвигаются СИНХРОННО с воскресным
// (ведущим). Апостольские чтения — НЕЗАВИСИМЫЙ механизм со своей отступкой/преступкой,
// не всегда совпадает по неделе с Евангелием в тот же день. Точное правило для Апостола
// пока не подтверждено — apostleWeekMap ниже временно дублирует евангельскую логику
// как заглушку, до уточнения.
//
// Январская (крещенская) отступка — между Неделей по Богоявлении и Неделей мясопустной
// образуется разрыв в 1–5 недель, заполняется повтором последних недель, отсчитывая
// НАЗАД от 33-й (подтверждено примером 2031: разрыв 2 недели → 32-я, 33-я).
//
// Источники: https://azbyka.ru/otstupka-i-prestupka, https://bogaiskov.ru/gospel-reading-arithmetic/,
// https://studfile.net/preview/13244754/page:29/, https://webtypikon.ru/ (сверка на конкретных днях).
import { orthodoxEaster } from "date-easter";

const OLD_STYLE_OFFSET_DAYS = 13;
const DAY_MS = 24 * 60 * 60 * 1000;
const ELEVATION_TARGET_WEEK = 18; // с этой седмицы (Лука) должно начинаться чтение "по Воздвижении"
const OTSTUPKA_FILLER_START_WEEK = 10; // подтверждено примером 2010 года
const LAST_CANONICAL_WEEK = 33;

export interface ILectionaryYear {
    year: number;
    paschaDate: Date;
    pentecostDate: Date;
    elevationSunday: Date;
    theophanySunday: Date;
    meatfareSunday: Date;
    septemberAdjustment: { kind: "none" | "otstupka" | "prestupka"; weeks: number };
    januaryRepeatWeeks: number[]; // канонические номера седмиц, повторяемые перед мясопустной
    // realSundayIndex (1-based, считая от 1-й Недели по Пятидесятнице) -> канонический номер седмицы,
    // чьё зачало реально читается в этот день.
    gospelWeekMap: Map<number, number>;
    // TODO: неподтверждённая заглушка — Апостол имеет свой независимый механизм отступки/преступки,
    // не обязательно совпадающий по неделе с Евангелием. Пока дублирует gospelWeekMap.
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

const diffWeeksRound = (from: Date, to: Date): number => Math.round((+to - +from) / (7 * DAY_MS));

export const getPaschaDate = (year: number): Date => {
    const e = orthodoxEaster(year);
    return new Date(e.year, e.month - 1, e.day);
};

// Sept 14 / Jan 6 по старому стилю -> дата в новом стиле (действительно для 1900–2099,
// далее сдвиг Юлианского/Григорианского календаря меняется).
const oldStyleToNewStyle = (year: number, month: number, day: number): Date =>
    addDays(new Date(year, month - 1, day), OLD_STYLE_OFFSET_DAYS);

const buildGospelWeekMap = (
    elevationWeekNumber: number,
    septemberAdjustment: ILectionaryYear["septemberAdjustment"],
    januaryRepeatWeeks: number[],
): Map<number, number> => {
    const weekMap = new Map<number, number>();
    let cursor = 1;
    let nextRealCanonical: number;

    if (septemberAdjustment.kind === "otstupka") {
        // 1..17 как обычно. Затем (surplus+1) "лишних" позиций — включая саму "Неделю по
        // Воздвижении", она тоже ещё заполняющая, не настоящая 18-я! — заполняются зачалами
        // более ранних недель начиная с OTSTUPKA_FILLER_START_WEEK. Подтверждено примером
        // 2010: позиция 18 -> Недели 10-й, позиция 19 (= Неделя по Воздвижении) -> Недели 11-й.
        for (; cursor <= 17; cursor++) weekMap.set(cursor, cursor);
        const fillerCount = septemberAdjustment.weeks + 1;
        for (let offset = 0; offset < fillerCount; offset++, cursor++) {
            weekMap.set(cursor, OTSTUPKA_FILLER_START_WEEK + offset);
        }
        nextRealCanonical = ELEVATION_TARGET_WEEK; // настоящая 18-я всё ещё не прочитана
    } else if (septemberAdjustment.kind === "prestupka") {
        // Рабочая гипотеза (не подтверждена конкретным примером): седмицы перед
        // elevationWeekNumber пропускаются целиком, 18-я стартует прямо в эту позицию.
        for (; cursor < elevationWeekNumber; cursor++) weekMap.set(cursor, cursor);
        weekMap.set(cursor, ELEVATION_TARGET_WEEK);
        cursor++;
        nextRealCanonical = ELEVATION_TARGET_WEEK + 1;
    } else {
        for (; cursor <= elevationWeekNumber; cursor++) weekMap.set(cursor, cursor);
        nextRealCanonical = elevationWeekNumber + 1; // === ELEVATION_TARGET_WEEK + 1
    }

    // Дальше последовательно, пока не понадобится крещенский повтор перед мясопустной.
    while (nextRealCanonical < LAST_CANONICAL_WEEK - Math.max(0, januaryRepeatWeeks.length - 1) && nextRealCanonical <= LAST_CANONICAL_WEEK) {
        weekMap.set(cursor, nextRealCanonical);
        cursor++;
        nextRealCanonical++;
        if (nextRealCanonical > LAST_CANONICAL_WEEK) break;
    }
    januaryRepeatWeeks.forEach(w => {
        weekMap.set(cursor, w);
        cursor++;
    });

    return weekMap;
};

export const computeLectionaryYear = (year: number): ILectionaryYear => {
    const paschaDate = getPaschaDate(year);
    const pentecostDate = addDays(paschaDate, 49);
    const meatfareSunday = addDays(paschaDate, -63);

    // === Сентябрьская (крестовоздвиженская) ===
    const elevationDate = oldStyleToNewStyle(year, 9, 14);
    const elevationSunday = strictlyNextSunday(elevationDate);
    const elevationWeekNumber = diffWeeksRound(pentecostDate, elevationSunday);

    let septemberAdjustment: ILectionaryYear["septemberAdjustment"] = { kind: "none", weeks: 0 };
    if (elevationWeekNumber < ELEVATION_TARGET_WEEK) {
        septemberAdjustment = { kind: "prestupka", weeks: ELEVATION_TARGET_WEEK - elevationWeekNumber };
    } else if (elevationWeekNumber > ELEVATION_TARGET_WEEK) {
        septemberAdjustment = { kind: "otstupka", weeks: elevationWeekNumber - ELEVATION_TARGET_WEEK };
    }

    // === Январская (крещенская) ===
    const theophanyDate = oldStyleToNewStyle(year, 1, 6);
    const theophanySunday = strictlyNextSunday(theophanyDate);
    const gapWeeks = Math.max(0, diffWeeksRound(theophanySunday, meatfareSunday));
    // Повтор отсчитывается назад от 33-й седмицы: gap=1 -> [33], gap=2 -> [32,33], ...
    const januaryRepeatWeeks: number[] = [];
    for (let i = 0; i < gapWeeks; i++) {
        januaryRepeatWeeks.unshift(LAST_CANONICAL_WEEK - i);
    }

    const gospelWeekMap = buildGospelWeekMap(elevationWeekNumber, septemberAdjustment, januaryRepeatWeeks);
    // TODO: заглушка, см. комментарий у apostleWeekMap в интерфейсе выше.
    const apostleWeekMap = new Map(gospelWeekMap);

    return {
        year, paschaDate, pentecostDate, elevationSunday, theophanySunday, meatfareSunday,
        septemberAdjustment, januaryRepeatWeeks, gospelWeekMap, apostleWeekMap,
    };
};
