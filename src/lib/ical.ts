// Сборка iCalendar (RFC 5545). Отдельно от данных, чтобы формат можно было проверять
// сам по себе: тут только экранирование, сворачивание строк и склейка.

export interface CalendarEvent {
    uid: string;
    /** Дата события в виде YYYYMMDD — события суточные, времени у них нет. */
    date: string;
    summary: string;
    description?: string;
    url?: string;
}

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

    for (const event of events) {
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
            ...line("END", "VEVENT"),
        );
    }

    lines.push(...line("END", "VCALENDAR"));

    // RFC требует CRLF, и некоторые клиенты действительно отказываются читать с LF.
    return lines.join("\r\n") + "\r\n";
};
