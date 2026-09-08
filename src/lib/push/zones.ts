// ЧАСОВОЙ ПОЯС УСТРОЙСТВА — отдельно от хранилища, чтобы проверялось без базы.
//
// Тот же приём, что у `userAccess`: правило, от которого зависит, разбудим мы
// человека в восемь утра или в три ночи, должно проверяться тестом, а не
// доверием. Лежа рядом с `clientPromise`, оно тянуло бы в тест всю Mongo.
//
// Пояс приходит от устройства, то есть снаружи: `Intl` на неизвестной строке
// бросает, и одно кривое устройство положило бы рассылку всем остальным. Отсюда
// `null` вместо исключения во всех трёх.

/** Похоже ли на пояс IANA. */
export const knownTimeZone = (zone: string): boolean => {
    try {
        new Intl.DateTimeFormat("ru", { timeZone: zone });
        return true;
    } catch {
        return false;
    }
};

/** Который час там, где стоит телефон. `null` — пояс неизвестен. */
export const localHour = (timeZone: string, now: Date): number | null => {
    try {
        return Number(new Intl.DateTimeFormat("en-GB", {
            timeZone, hour: "2-digit", hour12: false,
        }).format(now));
    } catch {
        return null;
    }
};

/** Какое там сегодня число. `en-CA` берётся ради ISO-порядка, и только ради него. */
export const localDate = (timeZone: string, now: Date): string | null => {
    try {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        }).format(now);
    } catch {
        return null;
    }
};
