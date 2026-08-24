// Арифметика подвижного круга: в какую седмицу и день попадает дата относительно Пасхи.
//
// Вынесено из lib/calcDay отдельно и намеренно без единого обращения к базе: это самая
// опасная логика в проекте (из-за неё /api/calc когда-то отдавал 400 на неделях 2–33),
// а проверить её можно только если она не тянет за собой подключение к Mongo.
// В "weeks" неделя 1 по Пятидесятнице хранится как type:"Penticostarion" (спецназвания
// "День Святаго Духа"/"Неделя всех святых"), недели 2-33 — как type:"first".
export const typeForPenticostWeek = (week: number) => week === 1 ? "Penticostarion" : "first";

export const getWeekAndDay = (date: Date, easter: Date, prevEaster: Date) => {
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

