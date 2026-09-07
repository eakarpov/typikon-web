import Link from "next/link";
import type { UpcomingEvent } from "@/lib/pomyannik/reckoning";
import { between, todayIso } from "@/lib/pomyannik/reckoning";
import { EVENT_LABEL, humanDate, inDays, weekdayOf, YEARS } from "@/app/pomyannik/labels";

// БЛИЖАЙШЕЕ — то, ради чего помянник и открывают между службами: не список имён,
// а вопрос «кого поминать на этой неделе». Оттого он стоит вверху страницы, а не
// прячется во вкладку.

const Upcoming = ({ events, days }: { events: UpcomingEvent[]; days: number }) => {
    const today = todayIso();

    if (!events.length) {
        return (
            <p className="font-serif text-sm text-slate-600">
                В ближайшие {days} дней памятных дней по вашему помяннику нет.
            </p>
        );
    }

    return (
        <ul className="flex flex-col gap-1">
            {events.map((event, i) => {
                const away = between(today, event.date) ?? 0;
                return (
                    <li key={`${event.kind}-${event.date}-${event.personId ?? i}`}
                        className="font-serif text-sm flex flex-wrap gap-x-2 items-baseline">
                        <span className="text-slate-500 w-32 shrink-0">
                            {humanDate(event.date, false)}, {weekdayOf(event.date)}
                        </span>
                        <span className="text-slate-800">
                            {event.personId && event.name ? (
                                <Link href={`/pomyannik/${event.personId}`}
                                      className="text-red-900 hover:underline">
                                    {event.name}
                                </Link>
                            ) : null}
                            {event.personId ? " — " : ""}
                            {event.personId ? EVENT_LABEL[event.kind] : event.title}
                            {event.kind === "anniversary" && event.years ? `, ${YEARS(event.years)}` : ""}
                        </span>
                        {/* Неуставный день помечен прямо в строке: выдать указ за
                            Типикон легче всего именно в таком перечне */}
                        {event.custom && (
                            <span className="text-amber-700 text-xs" title={event.note}>
                                · день не уставный
                            </span>
                        )}
                        <span className="text-slate-400 text-xs">{inDays(away)}</span>
                    </li>
                );
            })}
        </ul>
    );
};

export default Upcoming;
