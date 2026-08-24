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
        if (diffDays >= -48) { // Великий пост: с Чистого понедельника (-48) по Страстную субботу (-1)
            const realVal = Math.floor((49 + diffDays) % 7);
            return { week: Math.floor((49 + diffDays + 6) / 7), day: !realVal ? 7 : realVal, type: "Fast" };
        } else if (diffDays >= -70) {
            // Подготовительный период Триоди: от Недели о мытаре и фарисее (ровно за 70 дней
            // до Пасхи) до Недели сыропустной (-49). Раскладка недель — та же, что в базе
            // после fix-triodion-preparatory-weeks:
            //   0 — Неделя о мытаре и фарисее (одна),
            //   1 — 34-я седмица по Пятидесятнице + Неделя о блудном сыне,
            //   2 — мясопустная седмица, 3 — сырная.
            // Дни: понедельник 1 … суббота 6, воскресенье 7 — как в седмицах поста.
            const offset = diffDays + 70;
            if (offset === 0) {
                return { week: 0, day: 7, type: "Triodion" };
            }
            const week = Math.ceil(offset / 7);
            return { week, day: offset - 7 * (week - 1), type: "Triodion" };
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

