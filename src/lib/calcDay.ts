import {orthodoxEaster} from "date-easter";
import {getTriodicItem} from "@/pages/api/calc/getTriodion";
import {getCalendarItem} from "@/pages/api/calc/getCalenar";
import {TextType} from "@/utils/texts";
import clientPromise from "@/lib/mongodb";
import {resolveDayPericopes} from "@/lib/pericopes";
import {computeLectionaryYear} from "@/utils/lectionaryCycle";
import {getDayMemories, IDayMemories} from "@/lib/signs/dayMemories";

// В "weeks" неделя 1 по Пятидесятнице хранится как type:"Penticostarion" (спецназвания
// "День Святаго Духа"/"Неделя всех святых"), недели 2-33 — как type:"first".
const typeForPenticostWeek = (week: number) => week === 1 ? "Penticostarion" : "first";

const getWeekAndDay = (date: Date, easter: Date, prevEaster: Date) => {
    const diffTime = date.getTime() - easter.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const diffTimePrevious = date.getTime() - prevEaster.getTime();
    const diffDaysPrevious = Math.ceil(diffTimePrevious / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        if (diffDays >= -49) { // Great Lention (exclude preparational weeks)
            const realVal = Math.floor((49 + diffDays) % 7);
            return { week: Math.floor((49 + diffDays + 6) / 7), day: !realVal ? 7 : realVal, type: "Fast" };
        } else { // Previous Penticostarion
            const week = Math.floor((diffDaysPrevious - 50) / 7) + 1;
            const day = Math.floor((diffDaysPrevious - 50) % 7) + 1;
            return { week, day, type: typeForPenticostWeek(week), pentecostAnchorYear: prevEaster.getFullYear() };
        }
    }
    if (diffDays <= 50) {
        // count from Pascha, 0 - sunday, 6 - saturday
        return { week: Math.floor(diffDays / 7) + 1, day: Math.floor(diffDays % 7), type: "Pascha" };
    } else {
        // count from Penticostarion, 1 - monday, 7 - sunday
        const week = Math.floor((diffDays - 50) / 7) + 1;
        const day = Math.floor((diffDays - 50) % 7) + 1;
        return { week, day, type: typeForPenticostWeek(week), pentecostAnchorYear: easter.getFullYear() };
    }
};

export interface ICalcDayResult {
    day: any;
    date: Date;
    search: any;
    memories: IDayMemories;
}

// Единая точка расчета "дня" (мердж подвижной Триоди и неподвижного календаря) —
// используется и /api/calc (для Калькулятора и виджета "Сегодня" на главной), и
// SSR-страницей /calculator/[date].
export const calcDay = async (dateStr: string, lang: string): Promise<ICalcDayResult | null> => {
    const dateObj = new Date(dateStr);
    const easter = orthodoxEaster(dateObj);
    const prevDateObj = new Date(dateStr);
    prevDateObj.setFullYear(prevDateObj.getFullYear() - 1);
    const prevEaster = orthodoxEaster(prevDateObj);
    const easterDate = new Date(
        `${easter.year}-${easter.month > 9 ? easter.month : `0${easter.month}`}-${easter.day}`
    );
    const prevEasterDate = new Date(
        `${prevEaster.year}-${prevEaster.month > 9 ? prevEaster.month : `0${prevEaster.month}`}-${prevEaster.day}`
    );

    const searchTriodion = getWeekAndDay(dateObj, easterDate, prevEasterDate);
    const triodicPromise = getTriodicItem(searchTriodion);

    const churchDate = new Date(dateObj.getTime() - 13 * 24 * 3600 * 1000);
    const calendarPromise = getCalendarItem(churchDate);
    const memoriesPromise = getDayMemories(churchDate.getMonth() + 1, churchDate.getDate());

    const [triodicDay, calendarDay, memories] = await Promise.all([triodicPromise, calendarPromise, memoriesPromise]);

    if (!triodicDay && !calendarDay) {
        return null;
    }

    // Отступка/преступка: зачало Евангелия/Апостола на Литургии может относиться
    // не к календарной позиции недели (searchTriodion.week), а к более ранней/поздней
    // канонической неделе — см. src/utils/lectionaryCycle.ts. Остальные поля дня
    // (кафизмы, тропари и т.п.) при этом продолжают браться из календарной позиции.
    if (triodicDay && searchTriodion.pentecostAnchorYear) {
        const lectionaryYear = computeLectionaryYear(searchTriodion.pentecostAnchorYear);
        const effectiveGospelWeek = lectionaryYear.gospelWeekMap.get(searchTriodion.week);
        const effectiveApostleWeek = lectionaryYear.apostleWeekMap.get(searchTriodion.week);

        if (effectiveGospelWeek && effectiveGospelWeek !== searchTriodion.week) {
            const gospelSource = await getTriodicItem({
                week: effectiveGospelWeek, day: searchTriodion.day, type: typeForPenticostWeek(effectiveGospelWeek),
            });
            if (gospelSource?.gospelLiturgy) triodicDay.gospelLiturgy = gospelSource.gospelLiturgy;
        }
        if (effectiveApostleWeek && effectiveApostleWeek !== searchTriodion.week) {
            const apostleSource = await getTriodicItem({
                week: effectiveApostleWeek, day: searchTriodion.day, type: typeForPenticostWeek(effectiveApostleWeek),
            });
            if (apostleSource?.apostleLiturgy) triodicDay.apostleLiturgy = apostleSource.apostleLiturgy;
        }
    }

    const client = await clientPromise;
    const db = client.db("typikon");
    if (!calendarDay) {
        return {
            day: await resolveDayPericopes(db, triodicDay, lang),
            date: churchDate,
            search: searchTriodion,
            memories,
        };
    }
    if (!triodicDay) {
        return {
            day: await resolveDayPericopes(db, calendarDay, lang),
            date: churchDate,
            search: searchTriodion,
            memories,
        };
    }
    const day = triodicDay;

    Object.values(TextType).map((tType) => {
        if (tType === TextType.SONG_6) {
            // after 6-th song Prologue is read, that's it can be added to triodic readings or not
            if (day.song6) {
                day.song6.items = [
                    ...(calendarDay.song6?.items || []),
                    ...day.song6.items,
                ]
            } else if (calendarDay.song6) {
                day.song6 = {...calendarDay.song6};
            }
        } else {
            // if polyeleos - 3-d song and polyeleos readings are replaced by readings of saint
            // in holidays - all triodic parts are replaced by holiday readings
            // P.S. are there some other cases?
            if (calendarDay[tType]?.items) {
                day[tType] = calendarDay[tType];
            }
        }
    });

    return {
        day: await resolveDayPericopes(db, day, lang),
        date: churchDate,
        search: searchTriodion,
        memories,
    };
};
