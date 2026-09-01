// Сборка iCalendar (RFC 5545). Отдельно от данных, чтобы формат можно было проверять
// сам по себе: тут только экранирование, сворачивание строк и склейка.

interface CalendarEventBase {
    uid: string;
    summary: string;
    description?: string;
    url?: string;
    /**
     * Отменённое событие. Не выбрасывается, а помечается: у подписчика оно уже
     * лежит в календаре, и молча исчезнуть из ленты значит остаться у него
     * навсегда. STATUS:CANCELLED убирает его и там.
     */
    cancelled?: boolean;
}

export interface AllDayEvent extends CalendarEventBase {
    /** Дата события в виде YYYYMMDD — события суточные, времени у них нет. */
    date: string;
}

/**
 * Событие со временем. Час местный, и потому обязателен пояс: без него
 * календарь подписчика из другого города поставит службу не на тот час.
 */
export interface TimedEvent extends CalendarEventBase {
    /** «20260412T233000» — местное время, без Z. */
    start: string;
    end: string;
    /** IANA, например Europe/Moscow. */
    tzid: string;
}

// РАСШИРЕНИЕ ОБЪЕДИНЕНИЕМ, А НЕ ЗАМЕНОЙ: ленте уставных чтений (calendar.ics)
// суточные события и нужны, она работает и менять её незачем.
export type CalendarEvent = AllDayEvent | TimedEvent;

const isTimed = (e: CalendarEvent): e is TimedEvent => "start" in e;

/**
 * ПОЯС НАДО ОБЪЯВИТЬ, А НЕ ТОЛЬКО НАЗВАТЬ. TZID без блока VTIMEZONE Apple
 * Calendar и Outlook кладут не туда: имя пояса им ни о чём не говорит, если в
 * файле нет правила перехода. Российские зоны с 2014 года летнего времени не
 * знают, и блок у них в шесть строк — генерировать нечего, проще перечислить.
 */
const VTIMEZONE_RU: Record<string, number> = {
    "Europe/Kaliningrad": 2, "Europe/Moscow": 3, "Europe/Simferopol": 3,
    "Europe/Volgograd": 3, "Europe/Kirov": 3, "Europe/Astrakhan": 4,
    "Europe/Saratov": 4, "Europe/Ulyanovsk": 4, "Europe/Samara": 4,
    "Asia/Yekaterinburg": 5, "Asia/Omsk": 6, "Asia/Novosibirsk": 7,
    "Asia/Barnaul": 7, "Asia/Tomsk": 7, "Asia/Novokuznetsk": 7,
    "Asia/Krasnoyarsk": 7, "Asia/Irkutsk": 8, "Asia/Chita": 9,
    "Asia/Yakutsk": 9, "Asia/Khandyga": 9, "Asia/Vladivostok": 10,
    "Asia/Ust-Nera": 10, "Asia/Magadan": 11, "Asia/Sakhalin": 11,
    "Asia/Srednekolymsk": 11, "Asia/Kamchatka": 12, "Asia/Anadyr": 12,
};

export const knownTimezone = (tzid: string) => tzid in VTIMEZONE_RU;

const offset = (hours: number) =>
    `+${String(hours).padStart(2, "0")}00`;

// В значениях экранируются обратный слэш, точка с запятой, запятая и перевод строки.
const escapeText = (value: string) =>
    value
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");

// Строка не длиннее 75 октетов, продолжение — с пробела в начале. Считаем именно
// октеты, а не символы: кириллица в UTF-8 занимает по два байта, и наивная резка
// по символам даёт слишком длинные строки, а резка посередине символа — битый файл.
const foldLine = (line: string): string[] => {
    const bytes = Buffer.from(line, "utf8");
    if (bytes.length <= 75) return [line];

    const parts: string[] = [];
    let start = 0;

    while (start < bytes.length) {
        // Первая строка — 75 октетов, продолжения на один меньше: место занимает пробел.
        const limit = parts.length === 0 ? 75 : 74;
        let end = Math.min(start + limit, bytes.length);

        // Не разрезаем многобайтовый символ: продолжающие байты имеют вид 10xxxxxx.
        while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
            end--;
        }

        parts.push(bytes.slice(start, end).toString("utf8"));
        start = end;
    }

    return parts.map((part, i) => (i === 0 ? part : ` ${part}`));
};

const line = (name: string, value: string) => foldLine(`${name}:${value}`);

export const buildCalendar = ({
    name,
    description,
    events,
    stamp,
    ttlHours = 12,
}: {
    name: string;
    description: string;
    events: CalendarEvent[];
    /** Момент генерации в UTC — попадает в DTSTAMP каждого события. */
    stamp: Date;
    ttlHours?: number;
}): string => {
    const dtstamp = `${stamp.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;

    const lines: string[] = [
        ...line("BEGIN", "VCALENDAR"),
        ...line("VERSION", "2.0"),
        ...line("PRODID", "-//typikon.su//Уставные чтения//RU"),
        ...line("CALSCALE", "GREGORIAN"),
        ...line("METHOD", "PUBLISH"),
        ...line("X-WR-CALNAME", escapeText(name)),
        ...line("X-WR-CALDESC", escapeText(description)),
        // Подсказка клиенту, как часто перечитывать: календари любят кэшировать надолго.
        ...line("X-PUBLISHED-TTL", `PT${ttlHours}H`),
        ...line("REFRESH-INTERVAL;VALUE=DURATION", `PT${ttlHours}H`),
    ];

    // Пояса объявляются один раз на календарь, до событий
    for (const tzid of new Set(events.filter(isTimed).map(e => e.tzid))) {
        const hours = VTIMEZONE_RU[tzid];
        if (hours === undefined) continue;   // неизвестный пояс — событие уйдёт в UTC
        lines.push(
            ...line("BEGIN", "VTIMEZONE"),
            ...line("TZID", tzid),
            ...line("BEGIN", "STANDARD"),
            ...line("DTSTART", "19700101T000000"),
            ...line("TZOFFSETFROM", offset(hours)),
            ...line("TZOFFSETTO", offset(hours)),
            ...line("TZNAME", `UTC${offset(hours)}`),
            ...line("END", "STANDARD"),
            ...line("END", "VTIMEZONE"),
        );
    }

    for (const event of events) {
        if (isTimed(event)) {
            const known = knownTimezone(event.tzid);
            lines.push(
                ...line("BEGIN", "VEVENT"),
                ...line("UID", event.uid),
                ...line("DTSTAMP", dtstamp),
                ...(known
                    ? [...line(`DTSTART;TZID=${event.tzid}`, event.start),
                       ...line(`DTEND;TZID=${event.tzid}`, event.end)]
                    // Пояса не знаем — не врём про него: время уходит как есть,
                    // а в описании об этом сказано словами
                    : [...line("DTSTART", event.start), ...line("DTEND", event.end)]),
                ...line("SUMMARY", escapeText(event.summary)),
                ...(event.description ? line("DESCRIPTION", escapeText(event.description)) : []),
                ...(event.url ? line("URL", event.url) : []),
                ...line("TRANSP", "OPAQUE"),
                ...(event.cancelled ? line("STATUS", "CANCELLED") : []),
                ...line("END", "VEVENT"),
            );
            continue;
        }
        // Суточное событие: DTEND — следующий день, так требует RFC.
        const end = new Date(
            Number(event.date.slice(0, 4)),
            Number(event.date.slice(4, 6)) - 1,
            Number(event.date.slice(6, 8)) + 1,
        );
        const dtend = `${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, "0")}${String(end.getDate()).padStart(2, "0")}`;

        lines.push(
            ...line("BEGIN", "VEVENT"),
            ...line("UID", event.uid),
            ...line("DTSTAMP", dtstamp),
            ...line("DTSTART;VALUE=DATE", event.date),
            ...line("DTEND;VALUE=DATE", dtend),
            ...line("SUMMARY", escapeText(event.summary)),
            ...(event.description ? line("DESCRIPTION", escapeText(event.description)) : []),
            ...(event.url ? line("URL", event.url) : []),
            ...line("TRANSP", "TRANSPARENT"),
            ...(event.cancelled ? line("STATUS", "CANCELLED") : []),
            ...line("END", "VEVENT"),
        );
    }

    lines.push(...line("END", "VCALENDAR"));

    // RFC требует CRLF, и некоторые клиенты действительно отказываются читать с LF.
    return lines.join("\r\n") + "\r\n";
};
