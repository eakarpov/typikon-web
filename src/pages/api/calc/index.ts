import {NextApiRequest, NextApiResponse} from "next";
import {orthodoxEaster} from "date-easter";
import {getTriodicItem} from "@/pages/api/calc/getTriodion";
import {getCalendarItem} from "@/pages/api/calc/getCalenar";
import {TextType} from "@/utils/texts";

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
            return { week: Math.floor((diffDaysPrevious - 50) / 7) + 1, day: Math.floor((diffDaysPrevious - 50) % 7) + 1, type: "Penticostarion" };
        }
    }
    if (diffDays <= 50) {
        // count from Pascha, 0 - sunday, 6 - saturday
        return { week: Math.floor(diffDays / 7) + 1, day: Math.floor(diffDays % 7), type: "Pascha" };
    } else {
        // count from Penticostarion, 1 - monday, 7 - sunday
        return { week: Math.floor((diffDays - 50) / 7) + 1, day: Math.floor((diffDays - 50) % 7) + 1, type: "Penticostarion" };
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const {date} = req.body;
        if (!date) {
            res.status(400).end();
        }
        const dateObj = new Date(date);
        let easter = orthodoxEaster(dateObj);
        const prevDateObj = new Date(date);
        prevDateObj.setFullYear(prevDateObj.getFullYear() - 1);
        let prevEaster = orthodoxEaster(prevDateObj);
        let easterDate = new Date(
            `${easter.year}-${easter.month > 9 ? easter.month : `0${easter.month}`}-${easter.day}`
        );
        let prevEasterDate = new Date(
            `${prevEaster.year}-${prevEaster.month > 9 ? prevEaster.month : `0${prevEaster.month}`}-${prevEaster.day}`
        );

        // if (easterDate.getTime() > dateObj.getTime()) {
        //     const prevYear = new Date(date);
        //     prevYear.setFullYear(prevYear.getFullYear() - 1);
        //     easter = orthodoxEaster(prevYear);
        //     easterDate = new Date(`${easter.year}-${easter.month > 9 ? easter.month : `0${easter.month}`}-${easter.day}`);
        // }

        if (dateObj.getTime() - easterDate.getTime() > 1000 * 3600 * 24 * 56) { // only pentacostarion, check penticostarion
            // res.status(400).end();
            // return;
        }

        // check triodion

        const searchTriodion = getWeekAndDay(dateObj, easterDate, prevEasterDate);
        const triodicPromise = getTriodicItem(searchTriodion);

        const churchDate = new Date(dateObj.getTime() - 13 * 24 * 3600 * 1000);
        const calendarPromise = getCalendarItem(churchDate);
        // console.log(churchDate);

        Promise.all<any>([triodicPromise, calendarPromise]).then<any, any>(([
            triodicDay,
            calendarDay,
        ]) => {
            if (!triodicDay && !calendarDay) {
                res.status(404).end();
                return;
            }
            if (!calendarDay) {
                res.status(200).json({
                    day: triodicDay,
                    date: churchDate,
                    search: searchTriodion,
                });
                return;
            }
            if (!triodicDay) {
                res.status(200).json({
                    day: calendarDay,
                    date: churchDate,
                    search: searchTriodion,
                });
                return;
            }
            const day = triodicDay;

            if (triodicDay.paschal === calendarDay.paschal) { // indeed triodic is for pascha circle not for triodic period itself...
                // check in triodion from mytar and pharisey week <> week days except sunday ?
                res.status(400).end();
                return;
            }
            Object.values(TextType).map((tType) => {
                if (tType === TextType.SONG_6) {
                    // after 6-th song Prologue is read, that's it can be added to triodic readings or not
                    // console.log(day.song6);
                    if (day.song6) {
                        // day.song6.items = day.song6.items?.flatMap((el: any) => {
                        //    if (!el.paschal && calendarDay.song6) {
                        //        return calendarDay.song6?.items;
                        //    }
                        //    return el;
                        // });
                        day.song6.items = [
                            ...(calendarDay.song6?.items || []),
                            ...day.song6.items,
                        ]
                        // console.log(day.song6);
                    } else if (calendarDay.song6) {
                        day.song6 = {...calendarDay.song6};
                        // console.log(day.song6);
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

            // console.log(churchDate, searchTriodion, day)

            // merge days here, send only { day: ..., date: ..., search: ... }
            res.status(200).json({
                day,
                date: churchDate,
                search: searchTriodion,
            });
        }).catch(() => {
            res.status(500).end();
        });
    }
};
