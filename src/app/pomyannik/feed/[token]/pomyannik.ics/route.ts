import { feedByToken, listPersons } from "@/lib/pomyannik/service";
import { shift, todayIso, upcoming, type UpcomingEvent } from "@/lib/pomyannik/reckoning";
import { buildCalendar, type CalendarEvent } from "@/lib/ical";

// ЛИЧНАЯ ЛЕНТА ПОМЯННИКА.
//
// Именины и годовщины приходят в тот календарь, которым человек уже пользуется:
// напоминание нужно за день, а не тогда, когда он зайдёт на сайт. Приём тот же,
// что у calendar.ics, но лента ЛИЧНАЯ, и оттого три отличия.
//
// НИКАКОГО КЭША. Ответ собирается на каждый запрос: календарь у человека один,
// спрашивает его клиент несколько раз в сутки, а правка помянника должна
// доходить сразу. Кэшировать личное по адресу — верный способ однажды показать
// одному чужое.
//
// ОКНО ГОДОВОЕ, а не в три месяца, как у чтений: именины и годовщины бывают раз
// в год, и лента в квартал показала бы человеку пустоту.
//
// ИМЕНА МОЖНО ВЫКЛЮЧИТЬ. Календарь синхронизируется с чужими службами и висит
// на экране блокировки; «Годовщина преставления: Мария» там видна всякому, кто
// возьмёт телефон в руки. Кому это не годится — получает счёт без имён.

export const dynamic = "force-dynamic";

const DAYS_BACK = 7;
const DAYS_AHEAD = 372;
const BASE_URL = "https://www.typikon.su";

/** Обезличенный заголовок: что за день, но не по ком. */
const anonymous = (event: UpcomingEvent): string => {
    switch (event.kind) {
        case "nameday": return "Именины";
        case "birthday": return "День рождения";
        case "anniversary": return "Годовщина преставления";
        case "third": return "Третий день";
        case "ninth": return "Девятый день";
        case "fortieth": return "Сороковой день";
        case "sorokoust-end": return "Оканчивается сорокоуст";
        default: return event.title;
    }
};

const describe = (event: UpcomingEvent, withNames: boolean): string | undefined => {
    const parts: string[] = [];
    if (event.kind === "anniversary" && event.years) parts.push(`Лет: ${event.years}`);
    if (event.note) parts.push(event.note);
    if (event.custom) {
        parts.push("День не уставный: определение Собора или указ, а не Типикон.");
    }
    if (withNames && event.personId) parts.push(`${BASE_URL}/pomyannik`);
    return parts.length ? parts.join("\n") : undefined;
};

export async function GET(_: Request, ctx: { params: Promise<{ token: string }> }) {
    const { token } = await ctx.params;
    const feed = await feedByToken(token);
    // Молчим о том, был ли такой адрес когда-нибудь: разница между «нет такого»
    // и «отозвали» тут никому не нужна, кроме подбирающего адреса.
    if (!feed) return new Response("Not found", { status: 404 });

    const persons = await listPersons(feed.userId);
    const from = shift(todayIso(), -DAYS_BACK) ?? todayIso();
    const events = upcoming(persons, from, DAYS_BACK + DAYS_AHEAD);

    const calendar: CalendarEvent[] = events.map(event => ({
        // Опознавательный знак события, а не адрес: сменится он — и у
        // подписчика прошлогодние именины останутся рядом с новыми.
        uid: `${event.personId ?? "obshchee"}-${event.kind}-${event.date}@typikon.su`,
        date: event.date.replace(/-/g, ""),
        summary: feed.withNames ? event.title : anonymous(event),
        description: describe(event, feed.withNames),
        ...(feed.withNames && event.personId ? { url: `${BASE_URL}/pomyannik` } : {}),
    }));

    const body = buildCalendar({
        name: "Помянник",
        description: "Именины, годовщины и поминальные дни — typikon.su",
        events: calendar,
        stamp: new Date(),
        ttlHours: 12,
    });

    return new Response(body, {
        headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="pomyannik.ics"',
            // Личное не кэшируем нигде по дороге: ни у нас, ни у посредников.
            "Cache-Control": "private, no-store",
            "X-Robots-Tag": "noindex, nofollow",
        },
    });
}
